import { Module } from '@nestjs/common';

import { FilesModule } from '../files/files.module.js';
import { AdminBotEmojisController, BotEmojisController } from './bot-emojis.controller.js';
import { BotEmojisService } from './bot-emojis.service.js';
import { EntityEmojisService } from './entity-emojis.service.js';

@Module({
  imports: [FilesModule],
  controllers: [AdminBotEmojisController, BotEmojisController],
  providers: [BotEmojisService, EntityEmojisService],
  exports: [EntityEmojisService],
})
export class BotEmojisModule {}
