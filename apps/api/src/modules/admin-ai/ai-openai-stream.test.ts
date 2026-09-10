import { describe, expect, it } from 'vitest';
import { AiOpenaiStream } from './ai-openai-stream.js';

const event = (body: object) => ({ event: '', data: JSON.stringify(body) });

describe('OpenAI-compatible completion stream', () => {
  it('accepts Kimi K3 repeated terminal usage chunk after tool calls', () => {
    const stream = new AiOpenaiStream(() => undefined);
    stream.accept(
      event({
        choices: [
          {
            index: 0,
            finish_reason: null,
            delta: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  index: 0,
                  id: 'search_cards:0',
                  type: 'function',
                  function: { name: 'search_cards', arguments: '{"query":"Neymar"}' },
                },
              ],
            },
          },
        ],
      }),
    );
    stream.accept(
      event({
        choices: [
          {
            index: 0,
            finish_reason: 'tool_calls',
            delta: { role: 'assistant', content: '', reasoning: null },
          },
        ],
      }),
    );

    expect(() =>
      stream.accept(
        event({
          choices: [
            {
              index: 0,
              finish_reason: 'tool_calls',
              delta: { role: 'assistant', content: '' },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        }),
      ),
    ).not.toThrow();
    stream.accept({ event: '', data: '[DONE]' });
    expect(stream.finish()).toEqual({
      content: '',
      toolCalls: [
        {
          id: 'search_cards:0',
          name: 'search_cards',
          arguments: '{"query":"Neymar"}',
        },
      ],
    });
  });

  it('accepts OpenCode Go empty cost metadata after DONE', () => {
    const stream = new AiOpenaiStream(() => undefined);
    stream.accept(
      event({
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            delta: { role: 'assistant', content: 'Pronto.' },
          },
        ],
      }),
    );
    stream.accept({ event: '', data: '[DONE]' });

    expect(() => stream.accept(event({ choices: [], cost: '0' }))).not.toThrow();
    expect(stream.finish()).toEqual({ content: 'Pronto.', toolCalls: [] });
  });
});
