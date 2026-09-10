import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type { JSONSchema7 } from 'ai';

export type AiConnection = {
  readonly provider: 'openai' | 'opencode-go' | 'anthropic';
  readonly baseUrl: string;
  readonly apiKey: string;
};

export type AiToolCall = {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
};

export type AiMessage = {
  readonly role: 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolCalls?: AiToolCall[];
  readonly toolCallId?: string;
};

export type AiToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly parameters: JSONSchema7;
};

export type AiCompletionInput = {
  readonly onText?: (delta: string) => void;
  readonly connection: AiConnection;
  readonly sessionId: string;
  readonly model: string;
  readonly system: string;
  readonly messages: AiMessage[];
  readonly tools: AiToolDefinition[];
};

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function array(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
export function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
export function malformed(): never {
  throw new BadGatewayException(
    'AI provider returned a malformed or unsupported tools completion. Choose a model supporting function tools.',
  );
}
export function unreachable(_value: never): never {
  throw new BadRequestException('Unsupported AI provider or message role.');
}
export function argumentsObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (record(parsed)) return parsed;
  } catch {
    throw new BadGatewayException('AI tool arguments must be a valid JSON object.');
  }
  return malformed();
}

export function parseCompletion(
  provider: AiConnection['provider'],
  body: unknown,
): { content: string; toolCalls: AiToolCall[] } {
  if (!record(body)) return malformed();
  const toolCalls: AiToolCall[] = [];
  switch (provider) {
    case 'openai':
    case 'opencode-go': {
      if (!array(body.choices) || body.choices.length !== 1) return malformed();
      const choice = body.choices[0];
      if (!record(choice) || !record(choice.message)) return malformed();
      const message = choice.message;
      if (
        message.role !== 'assistant' ||
        message.function_call != null ||
        (message.content != null && typeof message.content !== 'string') ||
        (message.tool_calls != null && !array(message.tool_calls))
      )
        return malformed();
      for (const call of message.tool_calls ?? []) {
        if (
          !record(call) ||
          call.type !== 'function' ||
          !text(call.id) ||
          !record(call.function) ||
          !text(call.function.name) ||
          typeof call.function.arguments !== 'string'
        )
          return malformed();
        argumentsObject(call.function.arguments);
        toolCalls.push({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        });
      }
      if (
        (choice.finish_reason !== 'stop' && choice.finish_reason !== 'tool_calls') ||
        (!toolCalls.length && !text(message.content))
      )
        return malformed();
      return { content: typeof message.content === 'string' ? message.content : '', toolCalls };
    }
    case 'anthropic': {
      if (body.role !== 'assistant' || !array(body.content)) return malformed();
      const parts: string[] = [];
      for (const block of body.content) {
        if (!record(block)) return malformed();
        switch (block.type) {
          case 'text':
            if (typeof block.text !== 'string') return malformed();
            parts.push(block.text);
            break;
          case 'tool_use':
            if (!text(block.id) || !text(block.name) || !record(block.input)) return malformed();
            toolCalls.push({
              id: block.id,
              name: block.name,
              arguments: JSON.stringify(block.input),
            });
            break;
          default:
            return malformed();
        }
      }
      if (
        toolCalls.length
          ? body.stop_reason !== 'tool_use'
          : (body.stop_reason !== 'end_turn' && body.stop_reason !== 'stop_sequence') ||
            !text(parts.join(''))
      )
        return malformed();
      return { content: parts.join(''), toolCalls };
    }
    default:
      return unreachable(provider);
  }
}
