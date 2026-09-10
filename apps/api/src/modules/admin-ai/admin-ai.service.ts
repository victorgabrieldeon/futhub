import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AiChatState,
  AiPromptInput,
  AiSavedConfig,
  AiSessionInput,
  AiStreamSink,
} from './admin-ai.dto.js';
import { adminAiSystemPrompt } from './admin-ai.prompt.js';
import { AiConfigService } from './ai-config.service.js';
import { AiHistoryService } from './ai-history.service.js';
import { AiProviderService } from './ai-provider.service.js';
import { type AiSession, AiSessions, appendAiMessage, flushAiResults } from './ai-sessions.js';
import { aiTools, parseAiCommand } from './ai-tools.js';
import { AiToolsService } from './ai-tools.service.js';

function safeFailure(error: unknown): string {
  if (error instanceof HttpException && error.getStatus() < 500) return error.message;
  return 'Operação não concluída. Confira o catálogo antes de propor novamente.';
}

@Injectable()
export class AdminAiService {
  constructor(
    @Inject(AiSessions) private readonly sessions: AiSessions,
    @Inject(AiConfigService) private readonly configs: AiConfigService,
    @Inject(AiProviderService) private readonly provider: AiProviderService,
    @Inject(AiToolsService) private readonly tools: AiToolsService,
    @Inject(AiHistoryService) private readonly history: AiHistoryService,
  ) {}

  async configure(owner: string, input: AiSessionInput): Promise<AiSavedConfig> {
    const connection = await this.configs.resolve(owner, input);
    const discovered = await this.provider.discover(connection);
    await this.configs.save(owner, connection, discovered.models);
    const config = await this.configs.get(owner);
    if (!config) throw new Error('Failed to load saved AI configuration.');
    return config;
  }

  async connectSaved(owner: string): Promise<AiChatState> {
    const config = await this.configs.load(owner);
    const session = this.sessions.create(owner, config.connection);
    session.state.models = config.saved.models;
    session.state.model = config.saved.model;
    await this.history.save(session);
    return structuredClone(session.state);
  }

  async connect(owner: string, input: AiSessionInput): Promise<AiChatState> {
    const connection = await this.configs.resolve(owner, input);
    const session = this.sessions.create(owner, connection);
    try {
      return await this.sessions.run(session, async () => {
        const discovered = await this.provider.discover(connection);
        session.state.models = discovered.models;
        session.state.notice = discovered.notice;
        await this.configs.save(owner, connection, discovered.models);
        await this.history.save(session);
      });
    } catch (error) {
      this.sessions.remove(owner, session.state.id);
      throw error;
    }
  }

  state(owner: string, id: string): AiChatState {
    return structuredClone(this.sessions.get(owner, id).state);
  }
  disconnect(owner: string, id: string): void {
    this.sessions.remove(owner, id);
  }

  message(
    owner: string,
    id: string,
    input: AiPromptInput,
    send?: AiStreamSink,
  ): Promise<AiChatState> {
    const session = this.sessions.get(owner, id);
    if (!input.message.trim() || !input.model.trim())
      throw new BadRequestException('Informe mensagem e modelo.');
    if (session.model && session.model !== input.model)
      throw new BadRequestException('Inicie outra sessão para trocar de modelo.');
    this.checkBudget(session);
    return this.run(session, async () => {
      session.model = input.model;
      session.state.model = input.model;
      await this.configs.saveModel(owner, input.model);
      session.state.notice = null;
      for (const { action, callId } of session.mutations.values()) {
        if (action.status !== 'pending') continue;
        action.status = 'rejected';
        action.result = 'Proposta substituída por nova mensagem. Nenhuma criação executada.';
        session.results.set(callId, action.result);
      }
      flushAiResults(session);
      appendAiMessage(session, { role: 'user', content: input.message });
      await this.history.save(session);
      send?.({ type: 'state', state: session.state });
      await this.respond(session, send);
    });
  }

  decide(
    session: AiSession,
    actionId: string,
    approved: boolean,
    send?: AiStreamSink,
  ): Promise<AiChatState> {
    const stored = session.mutations.get(actionId);
    if (!stored) throw new NotFoundException('Proposta não encontrada nesta sessão.');
    return this.run(session, async () => {
      if (stored.action.status !== 'pending') return;
      await this.history.save(session);
      session.state.notice = null;
      if (approved) {
        try {
          stored.action.result = await this.tools.execute(stored.command);
          stored.action.status = 'succeeded';
        } catch (error) {
          stored.action.result = safeFailure(error);
          stored.action.status = 'failed';
        }
      } else {
        stored.action.result =
          'Criação rejeitada pelo administrador. Não executar novamente sem nova solicitação.';
        stored.action.status = 'rejected';
      }
      session.results.set(
        stored.callId,
        JSON.stringify({ status: stored.action.status, result: stored.action.result }),
      );
      await this.history.save(session);
      send?.({ type: 'state', state: session.state });
      if (flushAiResults(session)) await this.respond(session, send);
    });
  }

  private checkBudget(session: AiSession): void {
    if (
      session.transcript.length >= 100 ||
      JSON.stringify(session.transcript).length > 256_000 ||
      session.state.actions.length >= 40
    ) {
      throw new BadRequestException(
        'Limite desta conversa atingido. Encerre a sessão e inicie outra.',
      );
    }
  }

  private run(session: AiSession, operation: () => Promise<void>): Promise<AiChatState> {
    return this.sessions.run(session, async () => {
      try {
        await operation();
      } finally {
        await this.history.save(session);
      }
    });
  }

  private async respond(session: AiSession, send?: AiStreamSink): Promise<void> {
    try {
      for (let round = 0; round < 6; round++) {
        this.checkBudget(session);
        const messageId = randomUUID();
        const reply = await this.provider.complete({
          connection: session.connection,
          sessionId: session.state.id,
          model: session.model ?? '',
          system: `${adminAiSystemPrompt}\nData atual (UTC): ${new Date().toISOString().slice(0, 10)}.`,
          messages: session.transcript,
          tools: aiTools.filter((tool) => tool.name !== 'web_search' || this.tools.webAvailable()),
          ...(send ? { onText: (delta: string) => send({ type: 'text', messageId, delta }) } : {}),
        });
        if (
          reply.toolCalls.length > 16 ||
          new Set(reply.toolCalls.map((call) => call.id)).size !== reply.toolCalls.length ||
          reply.toolCalls.some((call) => call.arguments.length > 16_000)
        ) {
          throw new BadGatewayException(
            'Resposta excedeu limites de tools. Peça menos ações por mensagem.',
          );
        }
        appendAiMessage(
          session,
          {
            role: 'assistant',
            content: reply.content,
            toolCalls: reply.toolCalls,
          },
          messageId,
        );
        if (!reply.toolCalls.length) return;
        session.round = reply.toolCalls;
        for (const call of reply.toolCalls) {
          try {
            const command = parseAiCommand(call);
            switch (command.name) {
              case 'create_team':
              case 'create_collection':
              case 'create_card':
              case 'create_pack': {
                const action = {
                  id: randomUUID(),
                  tool: command.name,
                  arguments: JSON.stringify(command.input),
                  status: 'pending' as const,
                  result: null,
                };
                session.state.actions.push(action);
                session.mutations.set(action.id, { action, command, callId: call.id });
                break;
              }
              case 'search_teams':
              case 'search_team_players':
              case 'search_collections':
              case 'search_cards':
              case 'web_search':
              case 'list_packs': {
                const result = await this.tools.read(command);
                session.results.set(
                  call.id,
                  result.length <= 32_000
                    ? result
                    : JSON.stringify({ error: 'Resultado muito grande; refine a busca.' }),
                );
                break;
              }
            }
          } catch (error) {
            session.results.set(call.id, JSON.stringify({ error: safeFailure(error) }));
          }
        }
        send?.({ type: 'state', state: session.state });
        if (!flushAiResults(session)) return;
      }
      session.state.notice =
        'Limite de consultas desta rodada atingido. Envie nova mensagem para continuar.';
    } catch (error) {
      // A provider failure never changes the outcome of an already executed mutation.
      session.state.notice =
        error instanceof HttpException
          ? error.message
          : 'Falha ao conversar com provedor. Tente nova mensagem ou reconecte.';
    }
  }
}
