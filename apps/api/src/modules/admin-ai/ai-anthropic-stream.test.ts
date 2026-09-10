import { describe, expect, it, vi } from 'vitest';
import { createCompletionStream } from './ai-completion-stream.js';

const event = (type: string, fields: object = {}) =>
  `event: ${type}\ndata: ${JSON.stringify({ type, ...fields })}\n\n`;
const start = event('message_start', {
  message: { role: 'assistant', content: [], stop_reason: null },
});
const block = (index: number, content_block: object) =>
  event('content_block_start', { index, content_block });
const delta = (index: number, value: object) =>
  event('content_block_delta', { index, delta: value });
const stopBlock = (index: number) => event('content_block_stop', { index });
const finish = (stop_reason = 'end_turn') => event('message_delta', { delta: { stop_reason } });
const done = event('message_stop');
const textBlock = block(0, { type: 'text', text: '' });
const text = delta(0, { type: 'text_delta', text: 'Olá 🌍' });
const toolBlock = block(0, { type: 'tool_use', id: 'tool-0', name: 'search', input: {} });

describe('Anthropic completion stream', () => {
  it.each(['end_turn', 'stop_sequence'])('emits byte-fragmented text before %s', (reason) => {
    // Given
    const onText = vi.fn();
    // When
    const stream = createCompletionStream('anthropic', onText);
    for (const byte of Buffer.from(start + event('ping') + textBlock + text))
      stream.push(Uint8Array.of(byte));
    // Then
    expect(onText.mock.calls).toEqual([['Olá 🌍']]);
    stream.push(Buffer.from(stopBlock(0) + finish(reason) + done));
    expect(stream.finish()).toEqual({ content: 'Olá 🌍', toolCalls: [] });
  });

  it('assembles indexed tool-only JSON after all blocks and message stop', () => {
    // Given
    const onText = vi.fn();
    // When
    const stream = createCompletionStream('anthropic', onText);
    stream.push(
      Buffer.from(
        start +
          toolBlock +
          block(1, { type: 'tool_use', id: 'tool-1', name: 'search', input: {} }) +
          delta(0, { type: 'input_json_delta', partial_json: '{"q":' }) +
          delta(1, { type: 'input_json_delta', partial_json: '{"q":"b"}' }) +
          delta(0, { type: 'input_json_delta', partial_json: '"a"}' }) +
          stopBlock(1) +
          stopBlock(0) +
          finish('tool_use') +
          done,
      ),
    );
    // Then
    expect(stream.finish()).toEqual({
      content: '',
      toolCalls: [
        { id: 'tool-0', name: 'search', arguments: '{"q":"a"}' },
        { id: 'tool-1', name: 'search', arguments: '{"q":"b"}' },
      ],
    });
    expect(onText).not.toHaveBeenCalled();
  });

  it('accepts zero-argument tools with empty input and no JSON deltas', () => {
    // Given / When
    const stream = createCompletionStream('anthropic', vi.fn());
    stream.push(Buffer.from(start + toolBlock + stopBlock(0) + finish('tool_use') + done));
    // Then
    expect(stream.finish().toolCalls).toEqual([{ id: 'tool-0', name: 'search', arguments: '{}' }]);
  });

  it('emits text in block start and ignores future events without inventing content', () => {
    // Given / When
    const onText = vi.fn();
    const stream = createCompletionStream('anthropic', onText);
    stream.push(
      Buffer.from(
        start +
          event('future_metadata', { value: 'ignored' }) +
          block(0, { type: 'text', text: 'hello' }) +
          stopBlock(0) +
          finish() +
          done,
      ),
    );
    // Then
    expect(stream.finish().content).toBe('hello');
    expect(onText.mock.calls).toEqual([['hello']]);
  });

  it.each([
    ['no start', textBlock + text + stopBlock(0) + finish() + done],
    ['duplicate start', start + start],
    ['missing message stop', start + textBlock + text + stopBlock(0) + finish()],
    ['missing finish reason', start + textBlock + text + stopBlock(0) + done],
    ['missing block stop', start + textBlock + text + finish() + done],
    ['empty content', start + finish() + done],
    ['token limit', start + textBlock + text + stopBlock(0) + finish('max_tokens') + done],
    ['pause turn', start + toolBlock + stopBlock(0) + finish('pause_turn') + done],
    ['refusal', start + textBlock + text + stopBlock(0) + finish('refusal') + done],
    ['upstream error', start + event('error', { error: { message: 'secret' } })],
    ['event mismatch', 'event: ping\ndata: {"type":"message_stop"}\n\n'],
    ['unknown block', start + block(0, { type: 'thinking', thinking: 'secret' })],
    ['unknown delta', start + textBlock + delta(0, { type: 'thinking_delta' })],
    ['missing block', start + text],
    ['duplicate block', start + textBlock + textBlock],
    ['wrong block index', start + block(2, { type: 'text', text: 'ok' })],
    ['stopped block delta', start + textBlock + stopBlock(0) + text],
    ['duplicate block stop', start + textBlock + stopBlock(0) + stopBlock(0)],
    ['wrong delta type', start + toolBlock + text],
    [
      'partial JSON',
      start +
        toolBlock +
        delta(0, { type: 'input_json_delta', partial_json: '{"q":' }) +
        stopBlock(0) +
        finish('tool_use') +
        done,
    ],
    [
      'array JSON',
      start +
        toolBlock +
        delta(0, { type: 'input_json_delta', partial_json: '[]' }) +
        stopBlock(0) +
        finish('tool_use') +
        done,
    ],
    ['wrong tool stop reason', start + toolBlock + stopBlock(0) + finish() + done],
    ['duplicate message stop', start + textBlock + text + stopBlock(0) + finish() + done + done],
    ['late content', start + textBlock + text + stopBlock(0) + finish() + textBlock + done],
    ['truncated SSE', start + textBlock + text + stopBlock(0) + finish() + done.slice(0, -1)],
  ])('rejects %s without exposing partial tool calls', (_name, source) => {
    // Given / When / Then
    expect(() => {
      const stream = createCompletionStream('anthropic', vi.fn());
      stream.push(Buffer.from(source));
      stream.finish();
    }).toThrow(/AI/);
  });
});
