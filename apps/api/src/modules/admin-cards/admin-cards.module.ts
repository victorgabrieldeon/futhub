import { Module } from '@nestjs/common';

import { AdminCardsController } from './admin-cards.controller.js';
import { AdminCardsService } from './admin-cards.service.js';
import { CardImageStorage } from './card-image-storage.service.js';
import { FootyLogosService } from './footy-logos.service.js';
import { FutGgRaritiesService } from './fut-gg-rarities.service.js';
import { PlayerPhotosService } from './player-photos.service.js';

@Module({
  controllers: [AdminCardsController],
  providers: [
    AdminCardsService,
    CardImageStorage,
    FootyLogosService,
    FutGgRaritiesService,
    PlayerPhotosService,
  ],
})
export class AdminCardsModule {}
