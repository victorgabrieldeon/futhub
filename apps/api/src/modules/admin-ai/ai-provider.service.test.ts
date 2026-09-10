import { describe, expect, it, vi } from 'vitest';
import { AiHttpClient } from './ai-http-client.js';
import { AiProviderService } from './ai-provider.service.js';
import type { AiCompletionInput, AiConnection } from './ai-provider.types.js';

const connection: AiConnection = {
  provider: 'openai',
  baseUrl: 'https://api.example.net/proxy/',
  apiKey: 'test-secret',
};
const input: AiCompletionInput = {
  connection,
  sessionId: 'session-1',
  model: 'test-model',
  system: 'Admin system',
  messages: [{ role: 'user', content: 'Hello' }],
  tools: [{ name: 'search', description: 'Search cards', parameters: { type: 'object' } }],
};

describe('AI provider adapter', () => {
  it('sends OpenAI function tools and parses tool calls', async () => {
    const client = new AiHttpClient();
    const request = vi.spyOn(client, 'request').mockResolvedValue({
      status: 200,
      body: {
        choices: [
          {
            index: 0,
            finish_reason: 'tool_calls',
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: { name: 'search', arguments: '{"q":"card"}' },
                },
              ],
            },
          },
        ],
      },
    });
    const result = await new AiProviderService(client).complete(input);
    expect(result).toEqual({
      content: '',
      toolCalls: [{ id: 'call-1', name: 'search', arguments: '{"q":"card"}' }],
    });
    expect(request).toHaveBeenCalledWith(
      new URL('https://api.example.net/proxy/chat/completions'),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-secret',
          'user-agent': expect.stringMatching(
            /^ai\/\S+ ai-sdk\/provider-utils\/\S+ runtime\/node.js\/\d+$/,
          ),
        },
        body: JSON.stringify({
          model: 'test-model',
          max_tokens: 4096,
          messages: [
            { role: 'system', content: 'Admin system' },
            { role: 'user', content: 'Hello' },
          ],
          tools: [{ type: 'function', function: input.tools[0] }],
          tool_choice: 'auto',
        }),
      },
    );
  });

  it('sends OpenCode Go function tools through Chat Completions without duplicating copied endpoint', async () => {
    const client = new AiHttpClient();
    const request = vi.spyOn(client, 'request').mockResolvedValue({
      status: 200,
      body: {
        choices: [
          { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Done' } },
        ],
      },
    });

    await new AiProviderService(client).complete({
      ...input,
      connection: {
        provider: 'opencode-go',
        baseUrl: 'https://opencode.ai/zen/go/v1/chat/completions',
        apiKey: 'test-secret',
      },
    });

    expect(request).toHaveBeenCalledWith(
      new URL('https://opencode.ai/zen/go/v1/chat/completions'),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-secret',
          'user-agent': expect.stringMatching(
            /^ai\/\S+ ai-sdk\/provider-utils\/\S+ runtime\/node.js\/\d+$/,
          ),
          'x-opencode-session': 'session-1',
        },
        body: expect.stringContaining('"tools"'),
      },
    );
  });

  it.each([404, 405, 501])(
    'offers manual model entry only when discovery is unsupported (%s)',
    async (status) => {
      const client = new AiHttpClient();
      vi.spyOn(client, 'request').mockResolvedValue({ status, body: 'secret raw error' });
      const result = await new AiProviderService(client).discover(connection);
      expect(result.models).toEqual([]);
      expect(result.notice).toMatch(/manual/i);
    },
  );

  it.each([401, 403, 429, 500])('fails with sanitized discovery error on %s', async (status) => {
    const client = new AiHttpClient();
    vi.spyOn(client, 'request').mockResolvedValue({
      status,
      body: { error: 'test-secret raw error' },
    });
    await expect(new AiProviderService(client).discover(connection)).rejects.toThrow(/AI provider/);
  });

  it('preserves assistant tool calls and corresponding results in OpenAI history', async () => {
    const client = new AiHttpClient();
    const request = vi.spyOn(client, 'request').mockResolvedValue({
      status: 200,
      body: {
        choices: [
          { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Done' } },
        ],
      },
    });
    await new AiProviderService(client).complete({
      ...input,
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'c1', name: 'search', arguments: '{}' }],
        },
        { role: 'tool', content: '{"items":[]}', toolCallId: 'c1' },
      ],
    });
    const body: unknown = JSON.parse(request.mock.calls[0]?.[1].body ?? 'null');
    expect(body).toMatchObject({
      messages: [
        { role: 'system', content: input.system },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: 'c1', type: 'function', function: { name: 'search', arguments: '{}' } },
          ],
        },
        { role: 'tool', content: '{"items":[]}', tool_call_id: 'c1' },
      ],
    });
  });

  it.each(['unregistered', 'duplicate'])(
    'rejects %s tool calls before returning commands',
    async (kind) => {
      const client = new AiHttpClient();
      const call = {
        id: 'c1',
        type: 'function',
        function: { name: kind === 'unregistered' ? 'delete_all' : 'search', arguments: '{}' },
      };
      vi.spyOn(client, 'request').mockResolvedValue({
        status: 200,
        body: {
          choices: [
            {
              index: 0,
              finish_reason: 'tool_calls',
              message: {
                role: 'assistant',
                content: null,
                tool_calls: kind === 'duplicate' ? [call, call] : [call],
              },
            },
          ],
        },
      });
      await expect(new AiProviderService(client).complete(input)).rejects.toThrow(
        /unsupported tools/,
      );
    },
  );

  it('deduplicates and sorts model IDs; empty valid list allows manual entry', async () => {
    const client = new AiHttpClient();
    vi.spyOn(client, 'request')
      .mockResolvedValueOnce({
        status: 200,
        body: { data: [{ id: 'z' }, { id: 'a' }, { id: 'z' }] },
      })
      .mockResolvedValueOnce({ status: 200, body: { data: [] } });
    const provider = new AiProviderService(client);
    await expect(provider.discover(connection)).resolves.toEqual({
      models: ['a', 'z'],
      notice: null,
    });
    expect((await provider.discover(connection)).notice).toMatch(/manual/i);
  });

  it.each([null, {}, { data: null }, { data: [null] }, { data: [{ id: '' }] }])(
    'rejects malformed model list %j',
    async (body) => {
      const client = new AiHttpClient();
      vi.spyOn(client, 'request').mockResolvedValue({ status: 200, body });
      await expect(new AiProviderService(client).discover(connection)).rejects.toThrow(
        /malformed model list/,
      );
    },
  );
});
