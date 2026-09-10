import type { LookupAddress, LookupAllOptions } from 'node:dns';
import { EventEmitter } from 'node:events';
import { IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import { Socket } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiHttpClient } from './ai-http-client.js';

const network = vi.hoisted(() => ({
  lookup:
    vi.fn<
      (
        host: string,
        options: LookupAllOptions,
        callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
      ) => void
    >(),
  request:
    vi.fn<
      (
        url: URL,
        options: RequestOptions,
        callback: (response: IncomingMessage) => void,
      ) => EventEmitter
    >(),
}));
vi.mock('node:dns', () => ({ lookup: network.lookup }));
vi.mock('node:https', () => ({ request: network.request }));

const endpoint = new URL('https://api.example.net/v1/models');
const options = { method: 'GET', headers: { Authorization: 'Bearer test-secret' } } as const;
let outgoing = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });

function respond(status: number, body: string): IncomingMessage {
  const call = network.request.mock.calls[0];
  if (!call) throw new Error('Expected HTTPS request');
  const response = new IncomingMessage(new Socket());
  response.statusCode = status;
  call[2](response);
  if (!response.destroyed) {
    response.emit('data', Buffer.from(body));
    response.emit('end');
  }
  return response;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  outgoing = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });
  network.lookup.mockImplementation((_host, _options, callback) =>
    callback(null, [{ address: '8.8.8.8', family: 4 }]),
  );
  network.request.mockReturnValue(outgoing);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('AI HTTPS transport', () => {
  it('delivers streaming bytes before upstream ends, without retrying POST', async () => {
    // Given
    const onChunk = vi.fn();
    const pending = new AiHttpClient().requestStream(endpoint, {
      ...options,
      method: 'POST',
      body: '{}',
      onChunk,
    });
    const response = new IncomingMessage(new Socket());
    response.statusCode = 200;
    response.headers['content-type'] = 'text/event-stream; charset=utf-8';
    network.request.mock.calls[0]?.[2](response);
    // When
    response.emit('data', Buffer.from('data: first\n\n'));
    // Then
    expect(onChunk).toHaveBeenCalledWith(Buffer.from('data: first\n\n'));
    response.emit('end');
    await expect(pending).resolves.toEqual({ status: 200, body: null });
    expect(network.request).toHaveBeenCalledOnce();
  });

  it.each(['8.8.8.8', '2606:4700:4700::1111'])(
    'pins public DNS result %s with TLS hostname intact',
    async (address) => {
      const family = address.includes(':') ? 6 : 4;
      network.lookup.mockImplementationOnce((_host, _options, callback) =>
        callback(null, [{ address, family }]),
      );
      const pending = new AiHttpClient().request(endpoint, options);
      const call = network.request.mock.calls[0];
      if (!call?.[1].lookup) throw new Error('Missing pinned lookup');
      network.lookup.mockImplementation((_host, _options, callback) =>
        callback(null, [{ address: '127.0.0.1', family: 4 }]),
      );
      const resolved = vi.fn();
      call[1].lookup('api.example.net', {}, resolved);
      expect(resolved).toHaveBeenCalledWith(null, address, family);
      call[1].lookup('api.example.net', { all: true }, resolved);
      expect(resolved).toHaveBeenLastCalledWith(null, [{ address, family }]);
      expect(call[0].hostname).toBe('api.example.net');
      expect(call[1]).toMatchObject({ agent: false, rejectUnauthorized: true, family });
      expect(network.lookup).toHaveBeenCalledTimes(1);
      respond(200, '{"data":[]}');
      await expect(pending).resolves.toEqual({ status: 200, body: { data: [] } });
    },
  );

  it.each([
    [],
    [{ address: '127.0.0.1', family: 4 }],
    [{ address: '::ffff:10.0.0.1', family: 6 }],
    [
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ],
    [{ address: '8.8.8.8', family: 6 }],
    [{ address: 'garbage', family: 4 }],
  ])('rejects unsafe DNS answer %j before HTTPS', async (...addresses) => {
    network.lookup.mockImplementationOnce((_host, _options, callback) => callback(null, addresses));
    await expect(new AiHttpClient().request(endpoint, options)).rejects.toThrow(/public Internet/);
    expect(network.request).not.toHaveBeenCalled();
  });

  it('sanitizes DNS errors', async () => {
    network.lookup.mockImplementationOnce((_host, _options, callback) =>
      callback(new Error('test-secret'), []),
    );
    await expect(new AiHttpClient().request(endpoint, options)).rejects.toThrow(
      'AI provider DNS lookup failed.',
    );
  });

  it('times out DNS and ignores late resolution', async () => {
    network.lookup.mockImplementationOnce(() => undefined);
    const pending = new AiHttpClient().request(endpoint, options);
    const assertion = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    network.lookup.mock.calls[0]?.[2](null, [{ address: '8.8.8.8', family: 4 }]);
    expect(network.request).not.toHaveBeenCalled();
  });

  it('times out HTTPS and destroys request', async () => {
    const pending = new AiHttpClient().request(endpoint, options);
    const assertion = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    expect(outgoing.destroy).toHaveBeenCalledOnce();
    const response = respond(200, '{}');
    expect(response.destroyed).toBe(true);
  });

  it.each([301, 302, 303, 307, 308])('rejects redirect %s without following it', async (status) => {
    const pending = new AiHttpClient().request(endpoint, options);
    const response = respond(status, 'test-secret');
    await expect(pending).rejects.toThrow(/redirects/);
    expect(response.destroyed).toBe(true);
    expect(network.request).toHaveBeenCalledOnce();
  });

  it.each([401, 404, 500])('discards non-JSON error body for status %s', async (status) => {
    const pending = new AiHttpClient().request(endpoint, options);
    respond(status, '<html>test-secret</html>');
    await expect(pending).resolves.toEqual({ status, body: null });
  });

  it('sanitizes malformed JSON response', async () => {
    const pending = new AiHttpClient().request(endpoint, options);
    respond(200, 'test-secret');
    await expect(pending).rejects.toThrow('AI provider returned invalid JSON.');
  });

  it('sanitizes socket error', async () => {
    const pending = new AiHttpClient().request(endpoint, options);
    outgoing.emit('error', new Error('test-secret'));
    await expect(pending).rejects.toThrow('AI provider HTTPS connection failed.');
  });

  it('rejects oversized UTF-8 request before DNS', async () => {
    await expect(
      new AiHttpClient().request(endpoint, {
        ...options,
        method: 'POST',
        body: 'é'.repeat(524289),
      }),
    ).rejects.toThrow(/1 MiB/);
    expect(network.lookup).not.toHaveBeenCalled();
  });

  it('rejects oversized response and closes stream', async () => {
    const pending = new AiHttpClient().request(endpoint, options);
    const response = respond(200, 'x'.repeat(2 * 1024 * 1024 + 1));
    await expect(pending).rejects.toThrow(/2 MiB/);
    expect(response.destroyed).toBe(true);
  });

  it.each(['https://127.0.0.1', 'http://api.example.net', 'https://user:secret@api.example.net'])(
    'revalidates direct request %s',
    async (url) => {
      await expect(new AiHttpClient().request(new URL(url), options)).rejects.toThrow();
      expect(network.request).not.toHaveBeenCalled();
    },
  );
});
