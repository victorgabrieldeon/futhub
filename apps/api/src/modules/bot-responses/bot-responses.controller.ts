import { Body, Controller, Get, Inject, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import {
  type BotResponseDefinitionDto,
  BotResponseDefinitionDtoSchema,
  type BotResponseTemplateDto,
  BotResponseTemplateDtoSchema,
} from './bot-responses.dto.js';
import { BotResponsesService } from './bot-responses.service.js';

@ApiTags('Administração / Respostas do bot')
@ApiBearerAuth('bearer')
@Controller('v1/admin/bot-responses')
@UseGuards(AdminAuthGuard)
export class AdminBotResponsesController {
  constructor(@Inject(BotResponsesService) private readonly responses: BotResponsesService) {}

  @Get('schema')
  @ApiOperation({
    operationId: 'getBotResponseSchema',
    summary: 'Lê o catálogo de respostas configuráveis do bot',
  })
  @ApiOkResponse({ standardSchema: z.array(BotResponseDefinitionDtoSchema) })
  schema(): BotResponseDefinitionDto[] {
    return this.responses.schema();
  }

  @Get(':key')
  @ApiOperation({
    operationId: 'getAdminBotResponse',
    summary: 'Lê o template editável de uma resposta do bot',
  })
  @ApiOkResponse({ standardSchema: BotResponseTemplateDtoSchema })
  get(@Param('key') key: string): Promise<BotResponseTemplateDto> {
    return this.responses.get(key);
  }

  @Put(':key')
  @ApiOperation({
    operationId: 'updateBotResponse',
    summary: 'Salva o template de uma resposta do bot',
  })
  @ApiOkResponse({ standardSchema: BotResponseTemplateDtoSchema })
  update(
    @Param('key') key: string,
    @Body({ schema: BotResponseTemplateDtoSchema }) input: BotResponseTemplateDto,
  ): Promise<BotResponseTemplateDto> {
    return this.responses.update(key, input);
  }
}

@ApiTags('Respostas do bot')
@ApiBearerAuth('bearer')
@Controller('v1/bot-responses')
@UseGuards(InternalAuthGuard)
export class BotResponsesController {
  constructor(@Inject(BotResponsesService) private readonly responses: BotResponsesService) {}

  @Get(':key')
  @ApiOperation({
    operationId: 'getBotResponse',
    summary: 'Lê o template em uso de uma resposta do bot',
  })
  @ApiOkResponse({ standardSchema: BotResponseTemplateDtoSchema })
  get(@Param('key') key: string): Promise<BotResponseTemplateDto> {
    return this.responses.get(key);
  }
}
