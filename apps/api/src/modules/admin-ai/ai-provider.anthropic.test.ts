import { describe, expect, it, vi } from 'vitest';
import { AiHttpClient } from './ai-http-client.js';
import { AiProviderService } from './ai-provider.service.js';
import type { AiCompletionInput, AiConnection } from './ai-provider.types.js';

const connection: AiConnection = {
  provider: 'anthropic',
  baseUrl: 'https://api.anthropic.com',
  apiKey: 'test-secret',
};
const input: AiCompletionInput = {
  connection,
  sessionId: 'session-1',
  model: 'test-model',
  system: 'Admin system',
  messages: [
    { role: 'user', content: 'Search' },
    {
      role: 'assistant',
      content: '',
      toolCalls: [
        { id: 'a', name: 'search', arguments: '{"q":"one"}' },
        { id: 'b', name: 'search', arguments: '{}' },
      ],
    },
    { role: 'tool', content: 'first', toolCallId: 'a' },
    { role: 'tool', content: 'second', toolCallId: 'b' },
  ],
  tools: [{ name: 'search', description: 'Search cards', parameters: { type: 'object' } }],
};

describe('Anthropic adapter', () => {
  it('sends separate system, tool use and grouped tool results', async () => {
    const client = new AiHttpClient();
    const request = vi.spyOn(client, 'request').mockResolvedValue({
      status: 200,
      body: {
        role: 'assistant',
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Searching. ' },
          { type: 'text', text: 'Again.' },
          { type: 'tool_use', id: 'c', name: 'search', input: { q: 'card' } },
        ],
      },
    });
    const result = await new AiProviderService(client).complete(input);
    expect(result).toEqual({
      content: 'Searching. Again.',
      toolCalls: [{ id: 'c', name: 'search', arguments: '{"q":"card"}' }],
    });
    const call = request.mock.calls[0];
    expect(call?.[0].href).toBe('https://api.anthropic.com/v1/messages');
    expect(call?.[1].headers).toEqual({
      'content-type': 'application/json',
      'x-api-key': 'test-secret',
      'anthropic-version': '2023-06-01',
    });
    const body: unknown = JSON.parse(call?.[1].body ?? 'null');
    expect(body).toEqual({
      model: 'test-model',
      system: 'Admin system',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Search' }] },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'a', name: 'search', input: { q: 'one' } },
            { type: 'tool_use', id: 'b', name: 'search', input: {} },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'a', content: 'first' },
            { type: 'tool_result', tool_use_id: 'b', content: 'second' },
          ],
        },
      ],
      tools: [{ name: 'search', description: 'Search cards', input_schema: { type: 'object' } }],
    });
  });

  it('discovers all pages and deduplicates model IDs', async () => {
    const client = new AiHttpClient();
    const request = vi
      .spyOn(client, 'request')
      .mockResolvedValueOnce({
        status: 200,
        body: { data: [{ id: 'z' }], has_more: true, last_id: 'z' },
      })
      .mockResolvedValueOnce({
        status: 200,
        body: { data: [{ id: 'a' }, { id: 'z' }], has_more: false, last_id: 'a' },
      });
    const result = await new AiProviderService(client).discover(connection);
    expect(result).toEqual({ models: ['a', 'z'], notice: null });
    expect(request.mock.calls.map(([url]) => url.href)).toEqual([
      'https://api.anthropic.com/v1/models',
      'https://api.anthropic.com/v1/models?after_id=z',
    ]);
  });

  it('bounds discovery to five pages and reports partial results', async () => {
    const client = new AiHttpClient();
    let page = 0;
    const request = vi.spyOn(client, 'request').mockImplementation(async () => {
      page++;
      return {
        status: 200,
        body: { data: [{ id: `model-${page}` }], has_more: true, last_id: `model-${page}` },
      };
    });
    const result = await new AiProviderService(client).discover(connection);
    expect(request).toHaveBeenCalledTimes(5);
    expect(result.models).toHaveLength(5);
    expect(result.notice).toMatch(/truncated/i);
  });

  it('rejects repeated pagination cursor', async () => {
    const client = new AiHttpClient();
    vi.spyOn(client, 'request').mockResolvedValue({
      status: 200,
      body: { data: [{ id: 'a' }], has_more: true, last_id: 'a' },
    });
    await expect(new AiProviderService(client).discover(connection)).rejects.toThrow(/pagination/);
  });

  it('encodes opaque cursors without changing destination', async () => {
    const client = new AiHttpClient();
    const request = vi
      .spyOn(client, 'request')
      .mockResolvedValueOnce({
        status: 200,
        body: { data: [{ id: 'a' }], has_more: true, last_id: 'https://127.0.0.1/?x=1&key=secret' },
      })
      .mockResolvedValueOnce({ status: 200, body: { data: [], has_more: false } });
    await new AiProviderService(client).discover(connection);
    expect(request.mock.calls[1]?.[0].origin).toBe('https://api.anthropic.com');
    expect([...(request.mock.calls[1]?.[0].searchParams.keys() ?? [])]).toEqual(['after_id']);
  });

  it.each([
    {
      role: 'assistant',
      stop_reason: 'max_tokens',
      content: [{ type: 'tool_use', id: 'a', name: 'search', input: {} }],
    },
    {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{ type: 'image', source: 'test-secret' }],
    },
    {
      role: 'assistant',
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'a', name: 'search', input: [] }],
    },
    { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'text', text: 'ok' }] },
    { role: 'assistant', stop_reason: 'end_turn', content: [] },
  ])('rejects malformed or unsupported completion %j', async (body) => {
    const client = new AiHttpClient();
    vi.spyOn(client, 'request').mockResolvedValue({ status: 200, body });
    await expect(new AiProviderService(client).complete(input)).rejects.toThrow(
      /malformed or unsupported tools/,
    );
  });
});
