import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AiChatAction, AiChatState } from './admin-ai.dto.js';
import type { AiConnection, AiMessage, AiToolCall } from './ai-provider.types.js';
import type { AiMutation } from './ai-tools.js';

export type AiSession = {
  readonly owner: string;
  readonly connection: AiConnection;
  readonly state: AiChatState;
  readonly transcript: AiMessage[];
  readonly mutations: Map<string, { command: AiMutation; callId: string; action: AiChatAction }>;
  readonly results: Map<string, string>;
  round: AiToolCall[];
  model: string | null;
  busy: boolean;
  touchedAt: number;
};

@Injectable()
export class AiSessions implements OnModuleDestroy {
  // ponytail: sessions and keys live in one process for 30 idle minutes; use encrypted shared storage for multi-replica deployment.
  private readonly sessions = new Map<string, AiSession>();
  private readonly cleanup = setInterval(() => this.expire(), 60_000).unref();

  create(owner: string, connection: AiConnection): AiSession {
    this.expire();
    if (this.sessions.size >= 100)
      throw new ServiceUnavailableException(
        'Limite de sessões IA atingido. Encerre uma sessão ou tente mais tarde.',
      );
    const session: AiSession = {
      owner,
      connection,
      state: { id: randomUUID(), models: [], model: null, notice: null, messages: [], actions: [] },
      transcript: [],
      mutations: new Map(),
      results: new Map(),
      round: [],
      model: null,
      busy: false,
      touchedAt: Date.now(),
    };
    this.sessions.set(session.state.id, session);
    return session;
  }

  get(owner: string, id: string): AiSession {
    this.expire();
    const session = this.sessions.get(id);
    if (!session || session.owner !== owner)
      throw new NotFoundException('Sessão IA encerrada ou expirada. Conecte novamente.');
    if (session.busy)
      throw new ConflictException('Sessão IA ocupada. Aguarde e consulte o estado novamente.');
    session.touchedAt = Date.now();
    return session;
  }

  remove(owner: string, id: string): void {
    this.get(owner, id);
    this.sessions.delete(id);
  }

  async run(session: AiSession, operation: () => Promise<void>): Promise<AiChatState> {
    if (session.busy) throw new ConflictException('Sessão IA ocupada.');
    session.busy = true;
    try {
      await operation();
      return structuredClone(session.state);
    } finally {
      session.busy = false;
      session.touchedAt = Date.now();
    }
  }

  private expire(): void {
    const cutoff = Date.now() - 30 * 60_000;
    for (const [id, session] of this.sessions) {
      if (!session.busy && session.touchedAt < cutoff) this.sessions.delete(id);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanup);
    this.sessions.clear();
  }
}

export function appendAiMessage(
  session: AiSession,
  message: AiMessage,
  id: string = randomUUID(),
): void {
  session.transcript.push(message);
  if (message.content)
    session.state.messages.push({ id, role: message.role, content: message.content });
}

export function flushAiResults(session: AiSession): boolean {
  if (session.round.some((call) => !session.results.has(call.id))) return false;
  for (const call of session.round)
    appendAiMessage(session, {
      role: 'tool',
      toolCallId: call.id,
      content: session.results.get(call.id) ?? '',
    });
  session.round = [];
  session.results.clear();
  return true;
}
