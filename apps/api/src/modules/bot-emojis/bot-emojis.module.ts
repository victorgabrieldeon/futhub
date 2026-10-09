import { Module } from '@nestjs/common';
import { AdminBotEmojisController, BotEmojisController } from './bot-emojis.controller.js';
import { BotEmojisService } from './bot-emojis.service.js';

@Module({
  controllers: [AdminBotEmojisController, BotEmojisController],
  providers: [BotEmojisService],
})
export class BotEmojisModule {}
