import { BadRequestException } from '@nestjs/common';
import { argumentsObject, text, unreachable } from './ai-provider.types.js';
import type { AiConnection, AiMessage } from './ai-provider.types.js';

export function openaiMessage(message: AiMessage): object {
  switch (message.role) {
    case 'user':
      return { role: 'user', content: message.content };
    case 'tool':
      if (!text(message.toolCallId))
        throw new BadRequestException('AI tool result requires a tool call ID.');
      return { role: 'tool', content: message.content, tool_call_id: message.toolCallId };
    case 'assistant':
      return {
        role: 'assistant',
        content: message.content,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => {
                argumentsObject(call.arguments);
                return {
                  id: call.id,
                  type: 'function',
                  function: { name: call.name, arguments: call.arguments },
                };
              }),
            }
          : {}),
      };
    default:
      return unreachable(message.role);
  }
}

export function responsesMessages(messages: AiMessage[]): object[] {
  const input: object[] = [];
  for (const message of messages) {
    switch (message.role) {
      case 'user':
        input.push({ role: 'user', content: message.content });
        break;
      case 'assistant':
        if (message.content) input.push({ role: 'assistant', content: message.content });
        for (const call of message.toolCalls ?? []) {
          argumentsObject(call.arguments);
          input.push({
            type: 'function_call',
            call_id: call.id,
            name: call.name,
            arguments: call.arguments,
          });
        }
        break;
      case 'tool':
        if (!text(message.toolCallId))
          throw new BadRequestException('AI tool result requires a tool call ID.');
        input.push({
          type: 'function_call_output',
          call_id: message.toolCallId,
          output: message.content,
        });
        break;
      default:
        unreachable(message.role);
    }
  }
  return input;
}

export function usesResponses(connection: AiConnection, model: string): boolean {
  return connection.provider === 'opencode-go' && /^gpt-/i.test(model);
}

export function anthropicMessages(messages: AiMessage[]): object[] {
  const turns: { role: 'user' | 'assistant'; content: object[] }[] = [];
  for (const message of messages) {
    switch (message.role) {
      case 'user':
        turns.push({ role: 'user', content: [{ type: 'text', text: message.content }] });
        break;
      case 'assistant':
        turns.push({
          role: 'assistant',
          content: [
            ...(message.content ? [{ type: 'text', text: message.content }] : []),
            ...(message.toolCalls ?? []).map((call) => ({
              type: 'tool_use',
              id: call.id,
              name: call.name,
              input: argumentsObject(call.arguments),
            })),
          ],
        });
        break;
      case 'tool': {
        if (!text(message.toolCallId))
          throw new BadRequestException('AI tool result requires a tool call ID.');
        const block = {
          type: 'tool_result',
          tool_use_id: message.toolCallId,
          content: message.content,
        };
        const previous = turns.at(-1);
        if (previous?.role === 'user') previous.content.push(block);
        else turns.push({ role: 'user', content: [block] });
        break;
      }
      default:
        unreachable(message.role);
    }
  }
  return turns;
}
