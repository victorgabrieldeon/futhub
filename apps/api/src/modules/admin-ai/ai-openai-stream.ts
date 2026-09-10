import { array, malformed, parseCompletion, record, text } from './ai-provider.types.js';
import { type AiSseEvent, streamIndex, streamObject } from './ai-sse-stream.js';

// Mutable wire accumulator; only finish exposes validated tool calls.
type Tool = { readonly id: string; readonly name: string; arguments: string };

export class AiOpenaiStream {
  private role: string | undefined;
  private content = '';
  private readonly tools = new Map<number, Tool>();
  private finishReason: string | undefined;
  private done = false;

  constructor(private readonly onText: (delta: string) => void) {}

  accept(event: AiSseEvent): void {
    if (event.event && event.event !== 'message') malformed();
    if (this.done) {
      const body = streamObject(event.data);
      if (
        array(body.choices) &&
        body.choices.length === 0 &&
        typeof body.cost === 'string' &&
        Object.keys(body).every((key) => key === 'choices' || key === 'cost')
      )
        return;
      malformed();
    }
    if (event.data === '[DONE]') {
      if (!this.finishReason) malformed();
      this.done = true;
      return;
    }
    const body = streamObject(event.data);
    if (body.error != null || !array(body.choices)) malformed();
    if (this.finishReason && record(body.usage)) {
      const choice = body.choices[0];
      if (!choice) return;
      if (
        body.choices.length === 1 &&
        record(choice) &&
        choice.index === 0 &&
        choice.finish_reason === this.finishReason &&
        record(choice.delta) &&
        (choice.delta.role === undefined || choice.delta.role === 'assistant') &&
        (choice.delta.content === undefined ||
          choice.delta.content === null ||
          choice.delta.content === '') &&
        choice.delta.tool_calls == null &&
        choice.delta.function_call == null &&
        choice.delta.refusal == null
      )
        return;
    }
    if (body.choices.length !== 1 || this.finishReason) malformed();
    const choice = body.choices[0];
    if (!record(choice) || choice.index !== 0 || !record(choice.delta)) malformed();
    const delta = choice.delta;
    if (delta.function_call != null || delta.refusal != null) malformed();
    if (delta.role !== undefined) {
      if (delta.role !== 'assistant') malformed();
      this.role = delta.role;
    }
    if (delta.content != null) {
      if (typeof delta.content !== 'string') malformed();
      this.content += delta.content;
      if (delta.content) this.onText(delta.content);
    }
    if (delta.tool_calls != null) {
      if (!array(delta.tool_calls)) malformed();
      for (const call of delta.tool_calls) this.accumulateTool(call);
    }
    if (choice.finish_reason != null) {
      if (choice.finish_reason !== 'stop' && choice.finish_reason !== 'tool_calls') malformed();
      this.finishReason = choice.finish_reason;
    }
  }

  finish(): ReturnType<typeof parseCompletion> {
    if (!this.done) return malformed();
    const tools = [...this.tools].sort(([left], [right]) => left - right);
    if (tools.some(([index], position) => index !== position)) return malformed();
    return parseCompletion('openai', {
      choices: [
        {
          finish_reason: this.finishReason,
          message: {
            // OpenAI-compatible providers may omit role from streamed deltas.
            role: this.role ?? 'assistant',
            content: this.content,
            tool_calls: tools.map(([, tool]) => ({
              id: tool.id,
              type: 'function',
              function: { name: tool.name, arguments: tool.arguments },
            })),
          },
        },
      ],
    });
  }

  private accumulateTool(value: unknown): void {
    if (!record(value) || value.custom != null || !record(value.function)) malformed();
    const index = streamIndex(value.index);
    const fn = value.function;
    let tool = this.tools.get(index);
    if (!tool) {
      if (value.type !== 'function' || !text(value.id) || !text(fn.name)) malformed();
      tool = { id: value.id, name: fn.name, arguments: '' };
      this.tools.set(index, tool);
    } else if (
      (value.type !== undefined && value.type !== 'function') ||
      (value.id !== undefined && value.id !== tool.id) ||
      (fn.name !== undefined && fn.name !== tool.name)
    )
      malformed();
    if (fn.arguments !== undefined) {
      if (typeof fn.arguments !== 'string') malformed();
      tool.arguments += fn.arguments;
    }
  }
}
