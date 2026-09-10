import { describe, expect, it, vi } from 'vitest';
import { AiHttpClient } from './ai-http-client.js';

describe('AI SDK secure fetch bridge', () => {
  it('returns a live event stream through the pinned HTTPS client', async () => {
    const client = new AiHttpClient();
    vi.spyOn(client, 'requestStream').mockImplementation(async (_url, options) => {
      options.onResponse?.(200, { 'content-type': 'text/event-stream' });
      options.onChunk(Buffer.from('data: first\n\n'));
      await Promise.resolve();
      options.onChunk(Buffer.from('data: second\n\n'));
      return { status: 200, body: null };
    });

    const response = await client.fetch('https://api.example.net/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"stream":true}',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(await response.text()).toBe('data: first\n\ndata: second\n\n');
  });

  it('adapts JSON responses without exposing the provider body to callers', async () => {
    const client = new AiHttpClient();
    vi.spyOn(client, 'request').mockResolvedValue({
      status: 401,
      body: { error: 'provider secret' },
    });

    const response = await client.fetch('https://api.example.net/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('');
  });
});
