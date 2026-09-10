import { Module } from '@nestjs/common';
import { AdminBotResponsesController, BotResponsesController } from './bot-responses.controller.js';
import { BotResponsesService } from './bot-responses.service.js';

@Module({
  controllers: [AdminBotResponsesController, BotResponsesController],
  providers: [BotResponsesService],
})
export class BotResponsesModule {}
