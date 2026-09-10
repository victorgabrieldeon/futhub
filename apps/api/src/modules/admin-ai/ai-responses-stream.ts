import {
  argumentsObject,
  array,
  malformed,
  parseCompletion,
  record,
  text,
} from './ai-provider.types.js';
import { type AiSseEvent, streamObject } from './ai-sse-stream.js';

type Completed = {
  readonly content: string;
  readonly toolCalls: ReturnType<typeof parseCompletion>['toolCalls'];
};

export class AiResponsesStream {
  private content = '';
  private completed: Completed | undefined;

  constructor(private readonly onText: (delta: string) => void) {}

  accept(event: AiSseEvent): void {
    if (event.data === '[DONE]') {
      if (!this.completed) malformed();
      return;
    }
    const body = streamObject(event.data);
    if (!text(body.type) || (event.event && event.event !== body.type) || this.completed)
      malformed();
    switch (body.type) {
      case 'response.output_text.delta':
        if (typeof body.delta !== 'string') malformed();
        this.content += body.delta;
        if (body.delta) this.onText(body.delta);
        return;
      case 'response.completed':
        this.completed = completion(body.response, this.content);
        return;
      case 'error':
      case 'response.failed':
      case 'response.incomplete':
        malformed();
        return;
      default:
        return;
    }
  }

  finish(): ReturnType<typeof parseCompletion> {
    if (!this.completed) return malformed();
    const result = this.completed;
    return parseCompletion('openai', {
      choices: [
        {
          finish_reason: result.toolCalls.length ? 'tool_calls' : 'stop',
          message: {
            role: 'assistant',
            content: result.content,
            tool_calls: result.toolCalls.map((tool) => ({
              id: tool.id,
              type: 'function',
              function: { name: tool.name, arguments: tool.arguments },
            })),
          },
        },
      ],
    });
  }
}

function completion(value: unknown, streamedContent: string): Completed {
  if (!record(value) || value.status !== 'completed' || !array(value.output)) return malformed();
  const content: string[] = [];
  const toolCalls: ReturnType<typeof parseCompletion>['toolCalls'] = [];
  for (const item of value.output) {
    if (!record(item)) return malformed();
    if (item.type === 'function_call') {
      if (!text(item.call_id) || !text(item.name) || typeof item.arguments !== 'string')
        malformed();
      argumentsObject(item.arguments);
      toolCalls.push({ id: item.call_id, name: item.name, arguments: item.arguments });
      continue;
    }
    if (item.type !== 'message') continue;
    if (item.role !== 'assistant' || !array(item.content)) return malformed();
    for (const part of item.content) {
      if (!record(part) || part.type !== 'output_text' || typeof part.text !== 'string')
        malformed();
      content.push(part.text);
    }
  }
  return { content: content.join('') || streamedContent, toolCalls };
}
