import { ApiClientError } from '@futhub/api-client';
import { adminApiOptions } from '../../api/admin-client';
import { type AiChatState, parseState, record } from './api';

export type StreamEvent =
  | Readonly<{ type: 'text'; messageId: string; delta: string }>
  | Readonly<{ type: 'state'; state: AiChatState }>
  | Readonly<{ type: 'done' }>;

function parseEvent(data: string): StreamEvent {
  const value: unknown = JSON.parse(data);
  if (record(value)) {
    if (value.type === 'error' && typeof value.message === 'string') throw new Error(value.message);
    if (value.type === 'done') return { type: 'done' };
    if (value.type === 'state') return { type: 'state', state: parseState(value.state) };
    if (
      value.type === 'text' &&
      typeof value.messageId === 'string' &&
      value.messageId &&
      typeof value.delta === 'string'
    )
      return { type: 'text', messageId: value.messageId, delta: value.delta };
  }
  throw new Error('Evento de conversa inválido. Confira o estado atualizado.');
}

export function applyStreamEvent(state: AiChatState, event: StreamEvent): AiChatState {
  if (event.type === 'state') {
    if (event.state.id !== state.id) throw new Error('Resposta de outra sessão recusada.');
    const incoming = new Map(event.state.messages.map((message) => [message.id, message]));
    const known = new Set(state.messages.map((message) => message.id));
    return {
      ...event.state,
      messages: [
        ...state.messages.flatMap((message) => {
          const replacement = incoming.get(message.id);
          return replacement ? [replacement] : message.role === 'assistant' ? [message] : [];
        }),
        ...event.state.messages.filter((message) => !known.has(message.id)),
      ],
    };
  }
  if (event.type === 'done') return state;
  const existing = state.messages.find((message) => message.id === event.messageId);
  if (existing && existing.role !== 'assistant') throw new Error('Delta de mensagem inválido.');
  return {
    ...state,
    messages: existing
      ? state.messages.map((message) =>
          message.id === event.messageId
            ? { ...message, content: message.content + event.delta }
            : message,
        )
      : [...state.messages, { id: event.messageId, role: 'assistant', content: event.delta }],
  };
}

export async function streamRequest(
  options: Readonly<{
    path: string;
    body: unknown;
    signal: AbortSignal;
    onEvent: (event: StreamEvent) => void;
  }>,
): Promise<void> {
  // ponytail: admin config exposes no raw response transport; mirror its same-origin cookie policy until it does.
  const headers = new Headers(adminApiOptions().headers);
  headers.delete('authorization');
  headers.set('content-type', 'application/json');
  headers.set('accept', 'text/event-stream');
  const response = await fetch(new URL(options.path, window.location.origin), {
    method: 'POST',
    body: JSON.stringify(options.body),
    headers,
    credentials: 'same-origin',
    signal: options.signal,
    redirect: 'error',
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiClientError(
      response.status,
      record(body) && typeof body.message === 'string'
        ? body.message
        : `Não foi possível receber a resposta (${response.status}).`,
    );
  }
  if (
    response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !==
      'text/event-stream' ||
    !response.body
  ) {
    await response.body?.cancel();
    throw new Error('A API não retornou um fluxo de conversa.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let finalState = false;
  try {
    while (true) {
      const chunk = await reader.read();
      options.signal.throwIfAborted();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let boundary = /\r?\n\r?\n/.exec(buffer);
      while (boundary) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        if (frame.length > 2 * 1024 * 1024) throw new Error('Evento de conversa muito grande.');
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (data) {
          const event = parseEvent(data);
          if (event.type === 'done') {
            if (!finalState) throw new Error('Conclusão recebida sem estado final.');
            return;
          }
          finalState = event.type === 'state';
          options.onEvent(event);
        }
        boundary = /\r?\n\r?\n/.exec(buffer);
      }
      if (buffer.length > 2 * 1024 * 1024) throw new Error('Evento de conversa muito grande.');
      if (chunk.done) throw new Error('Resposta interrompida antes da confirmação de conclusão.');
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
