import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { BadGatewayException, BadRequestException, HttpException } from '@nestjs/common';
import {
  APICallError,
  type AssistantContent,
  type FinishReason,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
  type TypedToolCall,
  generateText,
  jsonSchema,
  streamText,
  tool,
} from 'ai';
import { createCompletionStream } from './ai-completion-stream.js';
import type { AiHttpClient } from './ai-http-client.js';
import { normalizeAiBaseUrl } from './ai-http-client.js';
import { argumentsObject, malformed, text, unreachable } from './ai-provider.types.js';
import type {
  AiCompletionInput,
  AiMessage,
  AiToolCall,
  AiToolDefinition,
} from './ai-provider.types.js';

type Completion = Readonly<{ content: string; toolCalls: AiToolCall[] }>;

function model(
  input: AiCompletionInput,
  http: AiHttpClient,
  validation: ReturnType<typeof createCompletionStream> | undefined,
): LanguageModel {
  const baseURL = normalizeAiBaseUrl(input.connection.baseUrl);
  const responses = input.connection.provider === 'opencode-go' && /^gpt-/i.test(input.model);
  const fetch: typeof globalThis.fetch = async (url, init) => {
    const response = await http.fetch(url, init);
    if (!validation || !response.ok || !response.body) return response;
    // The SDK accepts EOF without protocol completion; retain our wire validation.
    return new Response(
      response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            validation.push(chunk);
            controller.enqueue(chunk);
          },
        }),
      ),
      { status: response.status, headers: response.headers },
    );
  };
  switch (input.connection.provider) {
    case 'openai':
      return createOpenAI({ baseURL, apiKey: input.connection.apiKey, fetch }).chat(input.model);
    case 'opencode-go': {
      const provider = createOpenAI({
        name: 'opencode-go',
        baseURL,
        apiKey: input.connection.apiKey,
        headers: { 'x-opencode-session': input.sessionId },
        fetch,
      });
      return responses ? provider.responses(input.model) : provider.chat(input.model);
    }
    case 'anthropic':
      return createAnthropic({ baseURL, apiKey: input.connection.apiKey, fetch }).messages(
        input.model,
      );
    default:
      return unreachable(input.connection.provider);
  }
}

function messages(source: readonly AiMessage[]): ModelMessage[] {
  const toolNames = new Map<string, string>();
  const result: ModelMessage[] = [];
  for (const message of source) {
    switch (message.role) {
      case 'user':
        result.push({ role: 'user', content: message.content });
        break;
      case 'assistant': {
        const content: AssistantContent = message.content
          ? [{ type: 'text', text: message.content }]
          : [];
        for (const call of message.toolCalls ?? []) {
          toolNames.set(call.id, call.name);
          content.push({
            type: 'tool-call',
            toolCallId: call.id,
            toolName: call.name,
            input: argumentsObject(call.arguments),
          });
        }
        result.push({ role: 'assistant', content });
        break;
      }
      case 'tool': {
        if (!text(message.toolCallId))
          throw new BadRequestException('AI tool result requires a tool call ID.');
        const toolName = toolNames.get(message.toolCallId);
        if (!toolName)
          throw new BadRequestException('AI tool result references an unknown tool call.');
        result.push({
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: message.toolCallId,
              toolName,
              output: { type: 'text', value: message.content },
            },
          ],
        });
        break;
      }
      default:
        unreachable(message.role);
    }
  }
  return result;
}

function tools(definitions: readonly AiToolDefinition[]): ToolSet {
  const result: ToolSet = {};
  for (const definition of definitions) {
    result[definition.name] = tool({
      description: definition.description,
      inputSchema: jsonSchema<Record<string, unknown>>(definition.parameters),
    });
  }
  return result;
}

function completion(
  content: string,
  calls: readonly TypedToolCall<ToolSet>[],
  definitions: readonly AiToolDefinition[],
  finishReason: FinishReason,
): Completion {
  if (
    (finishReason !== 'stop' && finishReason !== 'tool-calls') ||
    (finishReason === 'tool-calls' && !calls.length)
  )
    return malformed();
  const known = new Set(definitions.map(({ name }) => name));
  const toolCalls = calls.map((call) => {
    const args = JSON.stringify(call.input);
    if (
      !text(call.toolCallId) ||
      !known.has(call.toolName) ||
      typeof args !== 'string' ||
      ('invalid' in call && call.invalid)
    )
      return malformed();
    argumentsObject(args);
    return { id: call.toolCallId, name: call.toolName, arguments: args };
  });
  if (
    new Set(toolCalls.map(({ id }) => id)).size !== toolCalls.length ||
    (!toolCalls.length && !text(content))
  )
    return malformed();
  return { content, toolCalls };
}

function failure(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (APICallError.isInstance(error)) {
    if (error.statusCode !== undefined && error.statusCode >= 200 && error.statusCode < 300)
      return malformed();
    if (error.statusCode === 401 || error.statusCode === 403)
      throw new BadGatewayException(
        'AI provider authentication or access failed. Check the API key and permissions.',
      );
    if (error.statusCode === 429)
      throw new BadGatewayException('AI provider rate or quota limit reached.');
    if (error.statusCode && [400, 404, 405, 422, 501].includes(error.statusCode))
      throw new BadGatewayException(
        'AI provider rejected the model or tools request. Choose a model and endpoint supporting function tools.',
      );
  }
  throw new BadGatewayException(
    'AI provider request failed. Check provider availability and configuration.',
  );
}

export async function completeWithAiSdk(
  input: AiCompletionInput,
  http: AiHttpClient,
): Promise<Completion> {
  if (!text(input.model)) throw new BadRequestException('AI model ID is required.');
  if (input.connection.provider === 'opencode-go' && !text(input.sessionId))
    throw new BadRequestException('OpenCode Go requires an AI session ID.');
  const validation = input.onText
    ? createCompletionStream(
        input.connection.provider,
        () => undefined,
        input.connection.provider === 'opencode-go' && /^gpt-/i.test(input.model),
      )
    : undefined;
  const settings = {
    model: model(input, http, validation),
    system: input.system,
    messages: messages(input.messages),
    tools: tools(input.tools),
    maxOutputTokens: 4096,
    maxRetries: 0,
  };
  try {
    if (!input.onText) {
      const result = await generateText(settings);
      return completion(result.text, result.toolCalls, input.tools, result.finishReason);
    }
    // Handle errors below, without the SDK's default logging of provider payloads.
    const result = streamText({ ...settings, onError: () => undefined });
    for await (const part of result.fullStream) {
      if (part.type === 'error') throw part.error;
      if (part.type === 'text-delta') input.onText(part.text);
    }
    validation?.finish();
    return completion(
      await result.text,
      await result.toolCalls,
      input.tools,
      await result.finishReason,
    );
  } catch (error) {
    return failure(error);
  }
}
