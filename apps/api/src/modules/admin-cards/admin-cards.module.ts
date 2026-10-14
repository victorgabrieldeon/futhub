import { Module } from '@nestjs/common';

import { BotEmojisModule } from '../bot-emojis/bot-emojis.module.js';
import { FilesModule } from '../files/files.module.js';
import { AdminCardsController } from './admin-cards.controller.js';
import { AdminCardsService } from './admin-cards.service.js';
import { FootyLogosService } from './footy-logos.service.js';
import { FutGgRaritiesService } from './fut-gg-rarities.service.js';
import { PlayerPhotosService } from './player-photos.service.js';
import { SquadImportService } from './squad-import.service.js';

@Module({
  imports: [BotEmojisModule, FilesModule],
  controllers: [AdminCardsController],
  providers: [
    AdminCardsService,
    FootyLogosService,
    FutGgRaritiesService,
    PlayerPhotosService,
    SquadImportService,
  ],
  exports: [AdminCardsService, PlayerPhotosService],
})
export class AdminCardsModule {}
