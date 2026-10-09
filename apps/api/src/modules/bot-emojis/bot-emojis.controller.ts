import { SwaggerCustomizer, TypedBody, TypedParam, TypedRoute } from '@nestia/core';
import { Controller, HttpCode, Inject, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import type {
  BotEmojiDto,
  BotEmojiListDto,
  CreateBotEmojiDto,
  RenameBotEmojiDto,
} from './bot-emojis.dto.js';
import { BotEmojisService } from './bot-emojis.service.js';

@ApiTags('Emojis do bot')
@Controller('v1/admin/bot-emojis')
@UseGuards(AdminAuthGuard)
export class AdminBotEmojisController {
  constructor(@Inject(BotEmojisService) private readonly emojis: BotEmojisService) {}

  @TypedRoute.Get()
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'listAdminBotEmojis';
    route.security = [{ bearer: [] }];
  })
  list(): Promise<BotEmojiListDto> {
    return this.emojis.list();
  }

  @TypedRoute.Post()
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'createBotEmoji';
    route.security = [{ bearer: [] }];
  })
  create(@TypedBody() input: CreateBotEmojiDto): Promise<BotEmojiDto> {
    return this.emojis.create(input.name, input.image);
  }

  @TypedRoute.Patch(':id')
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'renameBotEmoji';
    route.security = [{ bearer: [] }];
  })
  rename(
    @TypedParam('id') id: string,
    @TypedBody() input: RenameBotEmojiDto,
  ): Promise<BotEmojiDto> {
    return this.emojis.rename(id, input.name);
  }

  @TypedRoute.Delete(':id')
  @HttpCode(204)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'deleteBotEmoji';
    route.security = [{ bearer: [] }];
  })
  remove(@TypedParam('id') id: string): Promise<void> {
    return this.emojis.remove(id);
  }
}

@ApiTags('Emojis do bot')
@Controller('v1/bot-emojis')
@UseGuards(InternalAuthGuard)
export class BotEmojisController {
  constructor(@Inject(BotEmojisService) private readonly emojis: BotEmojisService) {}

  @TypedRoute.Get()
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'listBotEmojis';
    route.security = [{ bearer: [] }];
  })
  list(): Promise<BotEmojiListDto> {
    return this.emojis.list(false);
  }
}
