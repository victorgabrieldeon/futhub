import { createHash } from 'node:crypto';
import { SwaggerCustomizer, TypedBody, TypedParam, TypedQuery, TypedRoute } from '@nestia/core';
import { Controller, Header, HttpCode, Inject, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import typia from 'typia';
import { AdminApiConfig, AdminAuthGuard } from '../auth/admin-auth.guard.js';
import type {
  AiApprovalInput,
  AiChatState,
  AiHistoryDetail,
  AiHistoryPage,
  AiHistoryQuery,
  AiPromptInput,
  AiSavedConfig,
  AiSessionInput,
} from './admin-ai.dto.js';
import { AdminAiService } from './admin-ai.service.js';
import { AiConfigService } from './ai-config.service.js';
import { AiHistoryService } from './ai-history.service.js';
import { describeAiStream, streamAiResponse } from './ai-response-stream.js';
import { AiSessions } from './ai-sessions.js';
import { AiToolsService } from './ai-tools.service.js';

function owner(config: AdminApiConfig): string {
  return createHash('sha256').update(config.token).digest('hex');
}

@ApiTags('Administração / Assistente IA')
@Controller('v1/admin/ai/sessions')
@UseGuards(AdminAuthGuard)
export class AdminAiController {
  constructor(
    @Inject(AdminApiConfig) private readonly adminConfig: AdminApiConfig,
    @Inject(AdminAiService) private readonly ai: AdminAiService,
    @Inject(AiSessions) private readonly sessions: AiSessions,
    @Inject(AiHistoryService) private readonly history: AiHistoryService,
    @Inject(AiConfigService) private readonly configs: AiConfigService,
    @Inject(AiToolsService) private readonly tools: AiToolsService,
  ) {}

  @TypedRoute.Get('capabilities')
  @Header('Cache-Control', 'no-store')
  capabilities(): { webSearch: boolean } {
    return { webSearch: this.tools.webAvailable() };
  }

  @TypedRoute.Get('config')
  @Header('Cache-Control', 'no-store')
  config(): Promise<AiSavedConfig | null> {
    return this.configs.get(owner(this.adminConfig));
  }

  @TypedRoute.Put('config')
  @Header('Cache-Control', 'no-store')
  configure(
    @TypedBody({ type: 'is', is: typia.createIs<AiSessionInput>() }) input: AiSessionInput,
  ): Promise<AiSavedConfig> {
    return this.ai.configure(owner(this.adminConfig), input);
  }

  @TypedRoute.Post('saved')
  @Header('Cache-Control', 'no-store')
  connectSaved(): Promise<AiChatState> {
    return this.ai.connectSaved(owner(this.adminConfig));
  }

  @TypedRoute.Get('history')
  @SwaggerCustomizer(({ swagger }) => {
    // ponytail: Nestia 12 emits required: [] for optional-only query DTOs; remove until generator upgrade.
    const schema = swagger.components.schemas?.AiHistoryQuery;
    if (schema && 'required' in schema && schema.required?.length === 0)
      schema.required = undefined;
  })
  @Header('Cache-Control', 'no-store')
  list(@TypedQuery() query: AiHistoryQuery): Promise<AiHistoryPage> {
    return this.history.list(owner(this.adminConfig), query.page);
  }

  @TypedRoute.Get('history/:id')
  @Header('Cache-Control', 'no-store')
  archived(@TypedParam('id') id: string): Promise<AiHistoryDetail> {
    return this.history.get(owner(this.adminConfig), id);
  }

  @Post(':id/messages/stream')
  @HttpCode(200)
  @SwaggerCustomizer(describeAiStream)
  streamMessage(
    @TypedParam('id') id: string,
    @TypedBody() input: AiPromptInput,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    return streamAiResponse(reply, (send) =>
      this.ai.message(owner(this.adminConfig), id, input, send),
    );
  }

  @Post(':id/actions/:actionId/stream')
  @HttpCode(200)
  @SwaggerCustomizer(describeAiStream)
  streamDecision(
    @TypedParam('id') id: string,
    @TypedParam('actionId') actionId: string,
    @TypedBody() input: AiApprovalInput,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const session = this.sessions.get(owner(this.adminConfig), id);
    return streamAiResponse(reply, (send) =>
      this.ai.decide(session, actionId, input.approved, send),
    );
  }

  @TypedRoute.Post()
  @Header('Cache-Control', 'no-store')
  connect(
    @TypedBody({ type: 'is', is: typia.createIs<AiSessionInput>() }) input: AiSessionInput,
  ): Promise<AiChatState> {
    return this.ai.connect(owner(this.adminConfig), input);
  }

  @TypedRoute.Get(':id')
  @Header('Cache-Control', 'no-store')
  state(@TypedParam('id') id: string): AiChatState {
    return this.ai.state(owner(this.adminConfig), id);
  }

  @TypedRoute.Post(':id/messages')
  @Header('Cache-Control', 'no-store')
  message(@TypedParam('id') id: string, @TypedBody() input: AiPromptInput): Promise<AiChatState> {
    return this.ai.message(owner(this.adminConfig), id, input);
  }

  @TypedRoute.Post(':id/actions/:actionId')
  @Header('Cache-Control', 'no-store')
  decide(
    @TypedParam('id') id: string,
    @TypedParam('actionId') actionId: string,
    @TypedBody() input: AiApprovalInput,
  ): Promise<AiChatState> {
    return this.ai.decide(this.sessions.get(owner(this.adminConfig), id), actionId, input.approved);
  }

  @TypedRoute.Delete(':id')
  @HttpCode(204)
  disconnect(@TypedParam('id') id: string): void {
    this.ai.disconnect(owner(this.adminConfig), id);
  }
}
