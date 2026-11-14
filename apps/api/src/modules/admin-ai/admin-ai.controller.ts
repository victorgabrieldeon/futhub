import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { AdminApiConfig, AdminAuthGuard } from '../auth/admin-auth.guard.js';
import {
  type AiApprovalInput,
  AiApprovalInputSchema,
  type AiCapabilities,
  AiCapabilitiesSchema,
  type AiChatState,
  AiChatStateSchema,
  type AiHistoryDetail,
  AiHistoryDetailSchema,
  type AiHistoryPage,
  AiHistoryPageSchema,
  type AiHistoryQuery,
  AiHistoryQuerySchema,
  type AiPromptInput,
  AiPromptInputSchema,
  type AiSavedConfig,
  AiSavedConfigSchema,
  type AiSessionInput,
  AiSessionInputSchema,
} from './admin-ai.dto.js';
import { AdminAiService } from './admin-ai.service.js';
import { AiConfigService } from './ai-config.service.js';
import { AiHistoryService } from './ai-history.service.js';
import { AI_STREAM_TAG, AiStreamDocs, streamAiResponse } from './ai-response-stream.js';
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

  @Get('capabilities')
  @ApiOperation({
    operationId: 'getAiCapabilities',
    summary: 'Lista os recursos disponíveis ao assistente IA',
  })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ standardSchema: AiCapabilitiesSchema })
  capabilities(): AiCapabilities {
    return { webSearch: this.tools.webAvailable() };
  }

  @Get('config')
  @ApiOperation({
    operationId: 'getAiConfig',
    summary: 'Lê a configuração salva do provedor de IA',
  })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ standardSchema: AiSavedConfigSchema.nullable() })
  config(): Promise<AiSavedConfig | null> {
    return this.configs.get(owner(this.adminConfig));
  }

  @Put('config')
  @ApiOperation({ operationId: 'saveAiConfig', summary: 'Salva a configuração do provedor de IA' })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ standardSchema: AiSavedConfigSchema })
  configure(@Body({ schema: AiSessionInputSchema }) input: AiSessionInput): Promise<AiSavedConfig> {
    return this.ai.configure(owner(this.adminConfig), input);
  }

  @Post('saved')
  @ApiOperation({
    operationId: 'connectSavedAiSession',
    summary: 'Abre uma sessão do assistente com a configuração salva',
  })
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ standardSchema: AiChatStateSchema })
  connectSaved(): Promise<AiChatState> {
    return this.ai.connectSaved(owner(this.adminConfig));
  }

  @Get('history')
  @ApiOperation({
    operationId: 'listAiHistory',
    summary: 'Lista o histórico de conversas do assistente',
  })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ standardSchema: AiHistoryPageSchema })
  list(@Query({ schema: AiHistoryQuerySchema }) query: AiHistoryQuery): Promise<AiHistoryPage> {
    return this.history.list(owner(this.adminConfig), query.page);
  }

  @Get('history/:id')
  @ApiOperation({ operationId: 'getAiHistory', summary: 'Lê uma conversa arquivada do assistente' })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ standardSchema: AiHistoryDetailSchema })
  archived(@Param('id') id: string): Promise<AiHistoryDetail> {
    return this.history.get(owner(this.adminConfig), id);
  }

  @Post()
  @ApiOperation({ operationId: 'createAiSession', summary: 'Abre uma sessão do assistente IA' })
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ standardSchema: AiChatStateSchema })
  connect(@Body({ schema: AiSessionInputSchema }) input: AiSessionInput): Promise<AiChatState> {
    return this.ai.connect(owner(this.adminConfig), input);
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getAiSession', summary: 'Lê o estado de uma sessão do assistente' })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ standardSchema: AiChatStateSchema })
  state(@Param('id') id: string): AiChatState {
    return this.ai.state(owner(this.adminConfig), id);
  }

  @Post(':id/messages')
  @ApiOperation({ operationId: 'sendAiMessage', summary: 'Envia uma mensagem ao assistente' })
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ standardSchema: AiChatStateSchema })
  message(
    @Param('id') id: string,
    @Body({ schema: AiPromptInputSchema }) input: AiPromptInput,
  ): Promise<AiChatState> {
    return this.ai.message(owner(this.adminConfig), id, input);
  }

  @Post(':id/actions/:actionId')
  @ApiOperation({
    operationId: 'decideAiAction',
    summary: 'Aprova ou rejeita uma ação proposta pelo assistente',
  })
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ standardSchema: AiChatStateSchema })
  decide(
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @Body({ schema: AiApprovalInputSchema }) input: AiApprovalInput,
  ): Promise<AiChatState> {
    return this.ai.decide(this.sessions.get(owner(this.adminConfig), id), actionId, input.approved);
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteAiSession', summary: 'Encerra uma sessão do assistente' })
  @HttpCode(204)
  disconnect(@Param('id') id: string): void {
    this.ai.disconnect(owner(this.adminConfig), id);
  }
}

// Separate controller: @nestjs/swagger concatenates class and method tags, and the SDK
// generator excludes streaming routes by this tag alone.
@ApiTags(AI_STREAM_TAG)
@Controller('v1/admin/ai/sessions')
@UseGuards(AdminAuthGuard)
export class AdminAiStreamController {
  constructor(
    @Inject(AdminApiConfig) private readonly adminConfig: AdminApiConfig,
    @Inject(AdminAiService) private readonly ai: AdminAiService,
    @Inject(AiSessions) private readonly sessions: AiSessions,
  ) {}

  @Post(':id/messages/stream')
  @ApiOperation({
    operationId: 'streamAiMessage',
    summary: 'Envia uma mensagem ao assistente com resposta em SSE',
  })
  @HttpCode(200)
  @AiStreamDocs()
  streamMessage(
    @Param('id') id: string,
    @Body({ schema: AiPromptInputSchema }) input: AiPromptInput,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    return streamAiResponse(reply, (send) =>
      this.ai.message(owner(this.adminConfig), id, input, send),
    );
  }

  @Post(':id/actions/:actionId/stream')
  @ApiOperation({
    operationId: 'streamAiAction',
    summary: 'Decide uma ação proposta com resposta em SSE',
  })
  @HttpCode(200)
  @AiStreamDocs()
  streamDecision(
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @Body({ schema: AiApprovalInputSchema }) input: AiApprovalInput,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const session = this.sessions.get(owner(this.adminConfig), id);
    return streamAiResponse(reply, (send) =>
      this.ai.decide(session, actionId, input.approved, send),
    );
  }
}
