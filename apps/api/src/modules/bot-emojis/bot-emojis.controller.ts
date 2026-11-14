import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import {
  type BotEmojiDto,
  BotEmojiDtoSchema,
  type BotEmojiListDto,
  BotEmojiListDtoSchema,
  type CreateBotEmojiDto,
  CreateBotEmojiDtoSchema,
  type RenameBotEmojiDto,
  RenameBotEmojiDtoSchema,
} from './bot-emojis.dto.js';
import { BotEmojisService } from './bot-emojis.service.js';

@ApiTags('Emojis do bot')
@ApiBearerAuth('bearer')
@Controller('v1/admin/bot-emojis')
@UseGuards(AdminAuthGuard)
export class AdminBotEmojisController {
  constructor(@Inject(BotEmojisService) private readonly emojis: BotEmojisService) {}

  @Get()
  @ApiOperation({
    operationId: 'listAdminBotEmojis',
    summary: 'Lista os emojis do bot para administração',
  })
  @ApiOkResponse({ standardSchema: BotEmojiListDtoSchema })
  list(): Promise<BotEmojiListDto> {
    return this.emojis.list();
  }

  @Post()
  @ApiOperation({ operationId: 'createBotEmoji', summary: 'Cria um emoji do bot' })
  @ApiCreatedResponse({ standardSchema: BotEmojiDtoSchema })
  create(
    @Body({ schema: CreateBotEmojiDtoSchema }) input: CreateBotEmojiDto,
  ): Promise<BotEmojiDto> {
    return this.emojis.create(input.name, input.image);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'renameBotEmoji', summary: 'Renomeia um emoji do bot' })
  @ApiOkResponse({ standardSchema: BotEmojiDtoSchema })
  rename(
    @Param('id') id: string,
    @Body({ schema: RenameBotEmojiDtoSchema }) input: RenameBotEmojiDto,
  ): Promise<BotEmojiDto> {
    return this.emojis.rename(id, input.name);
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteBotEmoji', summary: 'Remove um emoji do bot' })
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.emojis.remove(id);
  }
}

@ApiTags('Emojis do bot')
@ApiBearerAuth('bearer')
@Controller('v1/bot-emojis')
@UseGuards(InternalAuthGuard)
export class BotEmojisController {
  constructor(@Inject(BotEmojisService) private readonly emojis: BotEmojisService) {}

  @Get()
  @ApiOperation({
    operationId: 'listBotEmojis',
    summary: 'Lista os emojis usados nas respostas do bot',
  })
  @ApiOkResponse({ standardSchema: BotEmojiListDtoSchema })
  list(): Promise<BotEmojiListDto> {
    return this.emojis.list(false);
  }
}
