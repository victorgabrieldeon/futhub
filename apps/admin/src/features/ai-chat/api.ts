import { request } from '@futhub/api-client';
import { adminApiOptions } from '../../api/admin-client';

export type Connection = Readonly<{
  provider: 'openai' | 'opencode-go' | 'anthropic';
  baseUrl: string;
  apiKey: string;
}>;
export type SavedConnection = Readonly<{
  provider: Connection['provider'];
  baseUrl: string;
  apiKeyConfigured: true;
  models: readonly string[];
  model: string | null;
}>;
export type ChatMessage = Readonly<{
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
}>;
export type ChatAction = Readonly<{
  id: string;
  tool: 'create_team' | 'create_collection' | 'create_card' | 'create_pack';
  arguments: string;
  status: 'pending' | 'succeeded' | 'failed' | 'rejected';
  result: string | null;
}>;
export type AiChatState = Readonly<{
  id: string;
  models: readonly string[];
  model: string | null;
  notice: string | null;
  messages: readonly ChatMessage[];
  actions: readonly ChatAction[];
}>;

class ChatResponseError extends Error {
  readonly name = 'ChatResponseError';
  constructor() {
    super(
      'A API retornou uma resposta de conversa inválida. Atualize o estado antes de continuar.',
    );
  }
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function message(value: unknown): value is ChatMessage {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    typeof value.content === 'string' &&
    (value.role === 'user' || value.role === 'assistant' || value.role === 'tool')
  );
}
function action(value: unknown): value is ChatAction {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    typeof value.arguments === 'string' &&
    (value.result === null || typeof value.result === 'string') &&
    (value.tool === 'create_team' ||
      value.tool === 'create_collection' ||
      value.tool === 'create_card' ||
      value.tool === 'create_pack') &&
    (value.status === 'pending' ||
      value.status === 'succeeded' ||
      value.status === 'failed' ||
      value.status === 'rejected')
  );
}
export function parseState(value: unknown): AiChatState {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    !(value.model === null || typeof value.model === 'string') ||
    !(value.notice === null || typeof value.notice === 'string') ||
    !Array.isArray(value.models) ||
    !value.models.every((item: unknown) => typeof item === 'string') ||
    !Array.isArray(value.messages) ||
    !value.messages.every(message) ||
    !Array.isArray(value.actions) ||
    !value.actions.every(action)
  )
    throw new ChatResponseError();
  return {
    id: value.id,
    model: value.model,
    notice: value.notice,
    models: value.models,
    messages: value.messages,
    actions: value.actions,
  };
}

export function parseSavedConnection(value: unknown): SavedConnection | null {
  if (value === null) return null;
  if (
    !record(value) ||
    (value.provider !== 'openai' &&
      value.provider !== 'opencode-go' &&
      value.provider !== 'anthropic') ||
    typeof value.baseUrl !== 'string' ||
    !value.baseUrl ||
    value.apiKeyConfigured !== true ||
    !Array.isArray(value.models) ||
    !value.models.every((item: unknown) => typeof item === 'string') ||
    !(value.model === null || typeof value.model === 'string')
  )
    throw new ChatResponseError();
  return {
    provider: value.provider,
    baseUrl: value.baseUrl,
    apiKeyConfigured: value.apiKeyConfigured,
    models: value.models,
    model: value.model,
  };
}

export const sessionPath = (id: string) => `/v1/admin/ai/sessions/${encodeURIComponent(id)}`;
export const configPath = '/v1/admin/ai/sessions/config';

export async function chatRequest(path: string, init: RequestInit = {}): Promise<AiChatState> {
  const options = adminApiOptions();
  const value = await request<unknown>(path, {
    ...options,
    ...init,
    headers: {
      ...options.headers,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
  });
  return parseState(value);
}

export async function savedConnection(signal: AbortSignal): Promise<SavedConnection | null> {
  return parseSavedConnection(await request<unknown>(configPath, { ...adminApiOptions(), signal }));
}

export async function saveConnection(connection: Connection): Promise<SavedConnection> {
  const options = adminApiOptions();
  const value = await request<unknown>(configPath, {
    ...options,
    method: 'PUT',
    body: JSON.stringify({
      provider: connection.provider,
      baseUrl: connection.baseUrl,
      ...(connection.apiKey ? { apiKey: connection.apiKey } : {}),
    }),
    headers: { ...options.headers, 'content-type': 'application/json' },
  });
  const saved = parseSavedConnection(value);
  if (!saved) throw new ChatResponseError();
  return saved;
}

export async function disconnectSession(id: string): Promise<void> {
  try {
    await request<unknown>(sessionPath(id), { ...adminApiOptions(), method: 'DELETE' });
  } catch (error) {
    // ponytail: request parses successful 204 bodies as JSON; remove when client supports empty responses.
    if (!(error instanceof SyntaxError)) throw error;
  }
}
