import { SwaggerCustomizer, TypedBody, TypedParam, TypedRoute } from '@nestia/core';
import { Controller, Inject, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import type { BotResponseDefinitionDto, BotResponseTemplateDto } from './bot-responses.dto.js';
import { BotResponsesService } from './bot-responses.service.js';

@ApiTags('Admin bot responses')
@Controller('v1/admin/bot-responses')
@UseGuards(AdminAuthGuard)
export class AdminBotResponsesController {
  constructor(@Inject(BotResponsesService) private readonly responses: BotResponsesService) {}

  @TypedRoute.Get('schema')
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'getBotResponseSchema';
    route.security = [{ bearer: [] }];
  })
  schema(): BotResponseDefinitionDto[] {
    return this.responses.schema();
  }

  @TypedRoute.Get(':key')
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'getAdminBotResponse';
    route.security = [{ bearer: [] }];
  })
  get(@TypedParam('key') key: string): Promise<BotResponseTemplateDto> {
    return this.responses.get(key);
  }

  @TypedRoute.Put(':key')
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'updateBotResponse';
    route.security = [{ bearer: [] }];
  })
  update(
    @TypedParam('key') key: string,
    @TypedBody() input: BotResponseTemplateDto,
  ): Promise<BotResponseTemplateDto> {
    return this.responses.update(key, input);
  }
}

@ApiTags('Bot responses')
@Controller('v1/bot-responses')
@UseGuards(InternalAuthGuard)
export class BotResponsesController {
  constructor(@Inject(BotResponsesService) private readonly responses: BotResponsesService) {}

  @TypedRoute.Get(':key')
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'getBotResponse';
    route.security = [{ bearer: [] }];
  })
  get(@TypedParam('key') key: string): Promise<BotResponseTemplateDto> {
    return this.responses.get(key);
  }
}
