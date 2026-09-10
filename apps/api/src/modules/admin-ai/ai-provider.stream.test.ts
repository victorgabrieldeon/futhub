import type { LookupAddress, LookupAllOptions } from 'node:dns';
import { EventEmitter } from 'node:events';
import { IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import { Socket } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiHttpClient } from './ai-http-client.js';
import { AiProviderService } from './ai-provider.service.js';
import type { AiCompletionInput, AiConnection } from './ai-provider.types.js';

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
let outgoing = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });
beforeEach(() => {
  vi.resetAllMocks();
  outgoing = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });
  network.lookup.mockImplementation((_host, _options, callback) =>
    callback(null, [{ address: '8.8.8.8', family: 4 }]),
  );
  network.request.mockReturnValue(outgoing);
});

const input: AiCompletionInput = {
  connection: { provider: 'openai', baseUrl: 'https://api.example.net/v1', apiKey: 'test-secret' },
  sessionId: 'session-1',
  model: 'test-model',
  system: 'system',
  messages: [{ role: 'user', content: 'hello' }],
  tools: [{ name: 'search', description: 'Search', parameters: { type: 'object' } }],
};
const openaiEvent = (delta: object, finish_reason: string | null = null) =>
  `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason }] })}\n\n`;
const anthropicEvent = (type: string, fields: object = {}) =>
  `event: ${type}\ndata: ${JSON.stringify({ type, ...fields })}\n\n`;
const responsesEvent = (type: string, fields: object = {}) =>
  `event: ${type}\ndata: ${JSON.stringify({ type, ...fields })}\n\n`;
const source = {
  openai: {
    first: openaiEvent({ role: 'assistant', content: 'Olá 🌍' }),
    last: `${openaiEvent({}, 'stop')}data: [DONE]\n\n`,
    endpoint: 'chat/completions',
  },
  'opencode-go': {
    first: openaiEvent({ role: 'assistant', content: 'Olá 🌍' }),
    last: `${openaiEvent({}, 'stop')}data: [DONE]\n\n`,
    endpoint: 'chat/completions',
  },
  anthropic: {
    first:
      anthropicEvent('message_start', {
        message: {
          id: 'message-1',
          model: 'test-model',
          role: 'assistant',
          content: [],
          usage: { input_tokens: 1, output_tokens: 0 },
        },
      }) +
      anthropicEvent('content_block_start', {
        index: 0,
        content_block: { type: 'text', text: '' },
      }) +
      anthropicEvent('content_block_delta', {
        index: 0,
        delta: { type: 'text_delta', text: 'Olá 🌍' },
      }),
    last:
      anthropicEvent('content_block_stop', { index: 0 }) +
      anthropicEvent('message_delta', {
        delta: { stop_reason: 'end_turn' },
        usage: { output_tokens: 1 },
      }) +
      anthropicEvent('message_stop'),
    endpoint: 'messages',
  },
} as const;

async function respond(status = 200): Promise<IncomingMessage> {
  await vi.waitFor(() => expect(network.request).toHaveBeenCalledOnce());
  const response = new IncomingMessage(new Socket());
  response.statusCode = status;
  response.headers['content-type'] = 'text/event-stream';
  const call = network.request.mock.calls[0];
  if (!call) throw new Error('Expected HTTPS request');
  call[2](response);
  return response;
}

describe('provider streaming through pinned HTTPS', () => {
  it.each<AiConnection['provider']>(['openai', 'opencode-go', 'anthropic'])(
    'streams %s live but resolves only after valid completion and EOF',
    async (provider) => {
      // Given
      const onText = vi.fn();
      const resolved = vi.fn();
      const pending = new AiProviderService(new AiHttpClient()).complete({
        ...input,
        connection: { ...input.connection, provider },
        onText,
      });
      void pending.then(resolved, () => undefined);
      const response = await respond();
      // When
      for (const byte of Buffer.from(source[provider].first))
        response.emit('data', Uint8Array.of(byte));
      // Then
      await vi.waitFor(() => expect(onText.mock.calls).toEqual([['Olá 🌍']]));
      const payload: unknown = JSON.parse(outgoing.end.mock.calls[0]?.[0] ?? 'null');
      expect(payload).toMatchObject({
        stream: true,
        model: input.model,
        tools: [expect.any(Object)],
      });
      expect(network.request.mock.calls[0]?.[0].pathname).toBe(`/v1/${source[provider].endpoint}`);
      expect(network.request.mock.calls[0]?.[1]).toMatchObject({
        agent: false,
        rejectUnauthorized: true,
      });
      response.emit('data', Buffer.from(source[provider].last));
      await Promise.resolve();
      expect(resolved).not.toHaveBeenCalled();
      response.emit('end');
      await expect(pending).resolves.toEqual({ content: 'Olá 🌍', toolCalls: [] });
      expect(network.request).toHaveBeenCalledOnce();
    },
  );

  it('streams OpenCode Go Responses models with text and tool calls', async () => {
    // Given
    const onText = vi.fn();
    const pending = new AiProviderService(new AiHttpClient()).complete({
      ...input,
      connection: { ...input.connection, provider: 'opencode-go' },
      model: 'gpt-5.6-luna',
      onText,
    });
    const response = await respond();
    // When
    response.emit(
      'data',
      Buffer.from(
        responsesEvent('response.output_item.added', {
          output_index: 0,
          item: { type: 'message', id: 'message-1' },
        }) +
          responsesEvent('response.output_text.delta', { item_id: 'message-1', delta: 'Olá 🌍' }) +
          responsesEvent('response.output_item.done', {
            output_index: 0,
            item: { type: 'message', id: 'message-1' },
          }) +
          responsesEvent('response.output_item.added', {
            output_index: 1,
            item: {
              type: 'function_call',
              id: 'function-1',
              call_id: 'call-search',
              name: 'search',
              arguments: '',
            },
          }) +
          responsesEvent('response.function_call_arguments.delta', {
            item_id: 'function-1',
            output_index: 1,
            delta: '{}',
          }) +
          responsesEvent('response.output_item.done', {
            output_index: 1,
            item: {
              type: 'function_call',
              id: 'function-1',
              call_id: 'call-search',
              name: 'search',
              arguments: '{}',
              status: 'completed',
            },
          }),
      ),
    );
    response.emit(
      'data',
      Buffer.from(
        responsesEvent('response.completed', {
          response: {
            status: 'completed',
            usage: { input_tokens: 1, output_tokens: 1 },
            output: [
              { type: 'function_call', call_id: 'call-search', name: 'search', arguments: '{}' },
            ],
          },
        }),
      ),
    );
    response.emit('end');
    // Then
    await expect(pending).resolves.toEqual({
      content: 'Olá 🌍',
      toolCalls: [{ id: 'call-search', name: 'search', arguments: '{}' }],
    });
    expect(onText).toHaveBeenCalledWith('Olá 🌍');
    expect(network.request.mock.calls[0]?.[0].pathname).toBe('/v1/responses');
    expect(JSON.parse(outgoing.end.mock.calls[0]?.[0] ?? 'null')).toMatchObject({
      model: 'gpt-5.6-luna',
      input: [
        { role: 'developer', content: input.system },
        { role: 'user', content: [{ type: 'input_text', text: input.messages[0]?.content }] },
      ],
      tools: [{ type: 'function', name: 'search' }],
      stream: true,
    });
  });

  it('sends OpenCode Go tool history through the Responses input contract', async () => {
    // Given
    const pending = new AiProviderService(new AiHttpClient()).complete({
      ...input,
      connection: { ...input.connection, provider: 'opencode-go' },
      model: 'gpt-5.6-luna',
      messages: [
        { role: 'user', content: 'Pesquise o Grêmio.' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call-search', name: 'search', arguments: '{"query":"Grêmio"}' }],
        },
        { role: 'tool', toolCallId: 'call-search', content: '["resultado"]' },
      ],
      onText: vi.fn(),
    });
    const response = await respond();
    // When
    response.emit(
      'data',
      Buffer.from(
        responsesEvent('response.output_item.added', {
          output_index: 0,
          item: { type: 'message', id: 'message-1' },
        }) +
          responsesEvent('response.output_text.delta', { item_id: 'message-1', delta: 'Pronto.' }) +
          responsesEvent('response.output_item.done', {
            output_index: 0,
            item: { type: 'message', id: 'message-1' },
          }),
      ),
    );
    response.emit(
      'data',
      Buffer.from(
        responsesEvent('response.completed', {
          response: {
            status: 'completed',
            output: [],
            usage: { input_tokens: 1, output_tokens: 1 },
          },
        }),
      ),
    );
    response.emit('end');
    // Then
    await expect(pending).resolves.toEqual({ content: 'Pronto.', toolCalls: [] });
    expect(JSON.parse(outgoing.end.mock.calls[0]?.[0] ?? 'null').input).toEqual([
      { role: 'developer', content: input.system },
      { role: 'user', content: [{ type: 'input_text', text: 'Pesquise o Grêmio.' }] },
      {
        type: 'function_call',
        call_id: 'call-search',
        name: 'search',
        arguments: '{"query":"Grêmio"}',
      },
      { type: 'function_call_output', call_id: 'call-search', output: '["resultado"]' },
    ]);
  });

  it.each(
    (['openai', 'opencode-go', 'anthropic'] as const).flatMap((provider) =>
      ['before-finish', 'after-finish'].map((stage) => ({ provider, stage })),
    ),
  )('rejects truncated $provider $stage after visible text', async ({ provider, stage }) => {
    // Given
    const onText = vi.fn();
    const pending = new AiProviderService(new AiHttpClient()).complete({
      ...input,
      connection: { ...input.connection, provider },
      onText,
    });
    const response = await respond();
    // When
    response.emit('data', Buffer.from(source[provider].first));
    if (stage === 'after-finish')
      response.emit(
        'data',
        Buffer.from(
          source[provider].last
            .replace('data: [DONE]\n\n', '')
            .replace(anthropicEvent('message_stop'), ''),
        ),
      );
    response.emit('end');
    // Then
    await expect(pending).rejects.toThrow(/malformed/);
    expect(onText).toHaveBeenCalledWith('Olá 🌍');
  });

  it.each(['duplicate', 'unknown', 'malformed'])(
    'rejects %s tools despite DONE and tool_calls finish',
    async (kind) => {
      // Given
      const call = {
        index: 0,
        id: 'call',
        type: 'function',
        function: {
          name: kind === 'unknown' ? 'other' : 'search',
          arguments: kind === 'malformed' ? '{' : '{}',
        },
      };
      const calls = kind === 'duplicate' ? [call, { ...call, index: 1 }] : [call];
      const pending = new AiProviderService(new AiHttpClient()).complete({
        ...input,
        onText: vi.fn(),
      });
      const response = await respond();
      // When
      response.emit(
        'data',
        Buffer.from(
          `${openaiEvent({ role: 'assistant', tool_calls: calls }, 'tool_calls')}data: [DONE]\n\n`,
        ),
      );
      response.emit('end');
      // Then
      await expect(pending).rejects.toThrow(/AI/);
    },
  );

  it('returns valid tool-only reply with identical completion contract', async () => {
    // Given
    const onText = vi.fn();
    const pending = new AiProviderService(new AiHttpClient()).complete({ ...input, onText });
    const response = await respond();
    // When
    response.emit(
      'data',
      Buffer.from(
        `${openaiEvent(
          {
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: 'call',
                type: 'function',
                function: { name: 'search', arguments: '{}' },
              },
            ],
          },
          'tool_calls',
        )}data: [DONE]\n\n`,
      ),
    );
    response.emit('end');
    // Then
    await expect(pending).resolves.toEqual({
      content: '',
      toolCalls: [{ id: 'call', name: 'search', arguments: '{}' }],
    });
    expect(onText).not.toHaveBeenCalled();
  });

  it.each([401, 429, 500])('sanitizes HTTP %s without emitting error body', async (status) => {
    // Given
    const onText = vi.fn();
    const pending = new AiProviderService(new AiHttpClient()).complete({ ...input, onText });
    const response = await respond(status);
    // When
    response.emit('data', Buffer.from('test-secret'));
    response.emit('end');
    // Then
    await expect(pending).rejects.toThrow(/^AI provider (authentication|rate|request)/);
    expect(onText).not.toHaveBeenCalled();
  });
});
