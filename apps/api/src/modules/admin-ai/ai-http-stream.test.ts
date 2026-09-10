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
const endpoint = new URL('https://api.example.net/v1/chat/completions');
const options = {
  method: 'POST',
  headers: { Authorization: 'Bearer test-secret' },
  body: '{}',
} as const;
let outgoing = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  outgoing = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });
  network.lookup.mockImplementation((_host, _options, callback) =>
    callback(null, [{ address: '8.8.8.8', family: 4 }]),
  );
  network.request.mockReturnValue(outgoing);
});
afterEach(() => vi.useRealTimers());

function respond(status = 200, contentType = 'text/event-stream'): IncomingMessage {
  const response = new IncomingMessage(new Socket());
  response.statusCode = status;
  response.headers['content-type'] = contentType;
  const call = network.request.mock.calls[0];
  if (!call) throw new Error('Expected HTTPS request');
  call[2](response);
  return response;
}

describe('streaming HTTPS safety', () => {
  it.each(['error', 'aborted', 'close'])(
    'rejects premature %s and ignores subsequent chunks',
    async (event) => {
      // Given
      const onChunk = vi.fn();
      const pending = new AiHttpClient().requestStream(endpoint, { ...options, onChunk });
      const assertion = expect(pending).rejects.toThrow(/^AI provider response/);
      const response = respond();
      // When
      response.emit(event, new Error('test-secret'));
      response.emit('data', Buffer.from('late'));
      response.emit('end');
      // Then
      await assertion;
      expect(onChunk).not.toHaveBeenCalled();
      expect(outgoing.destroy).toHaveBeenCalledOnce();
      expect(response.destroyed).toBe(true);
    },
  );

  it('enforces cumulative byte cap before delivering offending chunk', async () => {
    // Given
    const onChunk = vi.fn();
    const pending = new AiHttpClient().requestStream(endpoint, { ...options, onChunk });
    const response = respond();
    // When
    response.emit('data', Buffer.alloc(2 * 1024 * 1024));
    response.emit('data', Buffer.of(1));
    // Then
    await expect(pending).rejects.toThrow(/2 MiB/);
    expect(onChunk).toHaveBeenCalledOnce();
    expect(response.destroyed).toBe(true);
  });

  it('keeps total deadline during active streaming and ignores later chunks', async () => {
    // Given
    const onChunk = vi.fn();
    const pending = new AiHttpClient().requestStream(endpoint, { ...options, onChunk });
    const assertion = expect(pending).rejects.toThrow(/timed out/);
    const response = respond();
    // When
    await vi.advanceTimersByTimeAsync(29_999);
    response.emit('data', Buffer.from('first'));
    await vi.advanceTimersByTimeAsync(1);
    response.emit('data', Buffer.from('late'));
    // Then
    await assertion;
    expect(onChunk.mock.calls).toEqual([[Buffer.from('first')]]);
    expect(response.destroyed).toBe(true);
    expect(network.request).toHaveBeenCalledOnce();
  });

  it('sanitizes callback exceptions and cancels upstream without retry', async () => {
    // Given
    const onChunk = vi.fn(() => {
      throw new Error('test-secret');
    });
    const pending = new AiHttpClient().requestStream(endpoint, { ...options, onChunk });
    const response = respond();
    // When
    response.emit('data', Buffer.from('first'));
    response.emit('data', Buffer.from('late'));
    // Then
    await expect(pending).rejects.toThrow('AI provider stream processing failed.');
    expect(onChunk).toHaveBeenCalledOnce();
    expect(response.destroyed).toBe(true);
    expect(network.request).toHaveBeenCalledOnce();
  });

  it.each([301, 302, 307, 308])(
    'rejects redirect %s without exposing body or retrying POST',
    async (status) => {
      // Given
      const onChunk = vi.fn();
      const pending = new AiHttpClient().requestStream(endpoint, { ...options, onChunk });
      // When
      const response = respond(status);
      // Then
      await expect(pending).rejects.toThrow(/redirects/);
      expect(onChunk).not.toHaveBeenCalled();
      expect(response.destroyed).toBe(true);
      expect(network.request).toHaveBeenCalledOnce();
    },
  );

  it.each(['application/json', 'text/html', ''])(
    'rejects successful non-SSE content type %s',
    async (contentType) => {
      // Given
      const onChunk = vi.fn();
      const pending = new AiHttpClient().requestStream(endpoint, { ...options, onChunk });
      // When
      const response = respond(200, contentType);
      // Then
      await expect(pending).rejects.toThrow(/event stream/);
      expect(response.destroyed).toBe(true);
      expect(onChunk).not.toHaveBeenCalled();
    },
  );

  it('rejects mixed public/private DNS answers before streaming POST', async () => {
    // Given
    network.lookup.mockImplementationOnce((_host, _options, callback) =>
      callback(null, [
        { address: '8.8.8.8', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]),
    );
    // When / Then
    await expect(
      new AiHttpClient().requestStream(endpoint, { ...options, onChunk: vi.fn() }),
    ).rejects.toThrow(/public Internet/);
    expect(network.request).not.toHaveBeenCalled();
  });
});
