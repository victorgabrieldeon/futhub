import { AiOpenaiStream } from './ai-openai-stream.js';
import { unreachable } from './ai-provider.types.js';
import type { AiConnection, AiToolCall } from './ai-provider.types.js';
import { AiResponsesStream } from './ai-responses-stream.js';
import { AiSseStream } from './ai-sse-stream.js';

export function createCompletionStream(
  provider: AiConnection['provider'],
  onText: (delta: string) => void,
  responses = false,
): {
  readonly push: (chunk: Uint8Array) => void;
  readonly finish: () => { content: string; toolCalls: AiToolCall[] };
} {
  const completion = accumulator(provider, responses, onText);
  const sse = new AiSseStream((event) => completion.accept(event));
  return {
    push: (chunk) => sse.push(chunk),
    finish: () => {
      sse.finish();
      return completion.finish();
    },
  };
}

function accumulator(
  provider: AiConnection['provider'],
  responses: boolean,
  onText: (delta: string) => void,
) {
  if (responses) return new AiResponsesStream(onText);
  switch (provider) {
    case 'openai':
    case 'opencode-go':
      return new AiOpenaiStream(onText);
    case 'anthropic':
      return new AiAnthropicStream(onText);
    default:
      return unreachable(provider);
  }
}
import { AiAnthropicStream } from './ai-anthropic-stream.js';
