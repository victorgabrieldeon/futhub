import { createHash } from 'node:crypto';
import { SwaggerCustomizer, TypedBody, TypedParam, TypedQuery, TypedRoute } from '@nestia/core';
import { Controller, Header, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import typia from 'typia';
import { AdminAuthGuard, adminApiKeyFromHeaders } from '../auth/admin-auth.guard.js';
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

function owner(request: FastifyRequest): string {
  return createHash('sha256')
    .update(adminApiKeyFromHeaders(request.headers) ?? '')
    .digest('hex');
}

@ApiTags('Administração / Assistente IA')
@Controller('v1/admin/ai/sessions')
@UseGuards(AdminAuthGuard)
export class AdminAiController {
  constructor(
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
  config(@Req() request: FastifyRequest): Promise<AiSavedConfig | null> {
    return this.configs.get(owner(request));
  }

  @TypedRoute.Put('config')
  @Header('Cache-Control', 'no-store')
  configure(
    @Req() request: FastifyRequest,
    @TypedBody({ type: 'is', is: typia.createIs<AiSessionInput>() }) input: AiSessionInput,
  ): Promise<AiSavedConfig> {
    return this.ai.configure(owner(request), input);
  }

  @TypedRoute.Post('saved')
  @Header('Cache-Control', 'no-store')
  connectSaved(@Req() request: FastifyRequest): Promise<AiChatState> {
    return this.ai.connectSaved(owner(request));
  }

  @TypedRoute.Get('history')
  @SwaggerCustomizer(({ swagger }) => {
    // ponytail: Nestia 12 emits required: [] for optional-only query DTOs; remove until generator upgrade.
    const schema = swagger.components.schemas?.AiHistoryQuery;
    if (schema && 'required' in schema && schema.required?.length === 0)
      schema.required = undefined;
  })
  @Header('Cache-Control', 'no-store')
  list(
    @Req() request: FastifyRequest,
    @TypedQuery() query: AiHistoryQuery,
  ): Promise<AiHistoryPage> {
    return this.history.list(owner(request), query.page);
  }

  @TypedRoute.Get('history/:id')
  @Header('Cache-Control', 'no-store')
  archived(@Req() request: FastifyRequest, @TypedParam('id') id: string): Promise<AiHistoryDetail> {
    return this.history.get(owner(request), id);
  }

  @Post(':id/messages/stream')
  @HttpCode(200)
  @SwaggerCustomizer(describeAiStream)
  streamMessage(
    @Req() request: FastifyRequest,
    @TypedParam('id') id: string,
    @TypedBody() input: AiPromptInput,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    return streamAiResponse(reply, (send) => this.ai.message(owner(request), id, input, send));
  }

  @Post(':id/actions/:actionId/stream')
  @HttpCode(200)
  @SwaggerCustomizer(describeAiStream)
  streamDecision(
    @Req() request: FastifyRequest,
    @TypedParam('id') id: string,
    @TypedParam('actionId') actionId: string,
    @TypedBody() input: AiApprovalInput,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const session = this.sessions.get(owner(request), id);
    return streamAiResponse(reply, (send) =>
      this.ai.decide(session, actionId, input.approved, send),
    );
  }

  @TypedRoute.Post()
  @Header('Cache-Control', 'no-store')
  connect(
    @Req() request: FastifyRequest,
    @TypedBody({ type: 'is', is: typia.createIs<AiSessionInput>() }) input: AiSessionInput,
  ): Promise<AiChatState> {
    return this.ai.connect(owner(request), input);
  }

  @TypedRoute.Get(':id')
  @Header('Cache-Control', 'no-store')
  state(@Req() request: FastifyRequest, @TypedParam('id') id: string): AiChatState {
    return this.ai.state(owner(request), id);
  }

  @TypedRoute.Post(':id/messages')
  @Header('Cache-Control', 'no-store')
  message(
    @Req() request: FastifyRequest,
    @TypedParam('id') id: string,
    @TypedBody() input: AiPromptInput,
  ): Promise<AiChatState> {
    return this.ai.message(owner(request), id, input);
  }

  @TypedRoute.Post(':id/actions/:actionId')
  @Header('Cache-Control', 'no-store')
  decide(
    @Req() request: FastifyRequest,
    @TypedParam('id') id: string,
    @TypedParam('actionId') actionId: string,
    @TypedBody() input: AiApprovalInput,
  ): Promise<AiChatState> {
    return this.ai.decide(this.sessions.get(owner(request), id), actionId, input.approved);
  }

  @TypedRoute.Delete(':id')
  @HttpCode(204)
  disconnect(@Req() request: FastifyRequest, @TypedParam('id') id: string): void {
    this.ai.disconnect(owner(request), id);
  }
}
