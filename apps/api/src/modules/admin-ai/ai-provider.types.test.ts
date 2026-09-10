import { describe, expect, it } from 'vitest';
import { parseCompletion } from './ai-provider.types.js';

const call = {
  id: 'call-1',
  type: 'function',
  function: { name: 'search', arguments: '{"query":"card"}' },
};
const message = { role: 'assistant', content: null, tool_calls: [call] };

describe('AI completion response boundary', () => {
  it('accepts plain OpenAI text', () => {
    expect(
      parseCompletion('openai', {
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Done' } }],
      }),
    ).toEqual({ content: 'Done', toolCalls: [] });
  });

  it.each([undefined, null])('accepts tool-only response with content %s', (content) => {
    expect(
      parseCompletion('openai', {
        choices: [{ finish_reason: 'tool_calls', message: { ...message, content } }],
      }),
    ).toEqual({
      content: '',
      toolCalls: [{ id: 'call-1', name: 'search', arguments: '{"query":"card"}' }],
    });
  });

  it('accepts an OpenAI-compatible tool call marked as stop', () => {
    expect(
      parseCompletion('openai', {
        choices: [{ finish_reason: 'stop', message }],
      }),
    ).toEqual({
      content: '',
      toolCalls: [{ id: 'call-1', name: 'search', arguments: '{"query":"card"}' }],
    });
  });

  it('accepts absent optional tool fields serialized as null', () => {
    expect(
      parseCompletion('openai', {
        choices: [
          {
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'Done',
              tool_calls: null,
              function_call: null,
            },
          },
        ],
      }),
    ).toEqual({ content: 'Done', toolCalls: [] });
  });

  it.each([
    null,
    { choices: [] },
    { choices: [{ message }] },
    { choices: [{ finish_reason: 'length', message }] },
    { choices: [{ finish_reason: 'tool_calls', message: { ...message, tool_calls: [] } }] },
    { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: null } }] },
    { choices: [{ finish_reason: 'tool_calls', message: { ...message, function_call: {} } }] },
    { choices: [{ finish_reason: 'tool_calls', message: { ...message, tool_calls: [{}] } }] },
  ])('rejects malformed or unsupported response %j', (body) => {
    expect(() => parseCompletion('openai', body)).toThrow(/malformed or unsupported tools/);
  });

  it.each(['{"secret":', 'null', '[]', '1', '"text"'])('rejects tool arguments %s', (args) => {
    expect(() =>
      parseCompletion('openai', {
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              ...message,
              tool_calls: [{ ...call, function: { name: 'search', arguments: args } }],
            },
          },
        ],
      }),
    ).toThrow(/AI/);
  });
});
