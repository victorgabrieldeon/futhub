import { Module } from '@nestjs/common';

import { AdminCardsModule } from './modules/admin-cards/admin-cards.module.js';
import { AdminPacksModule } from './modules/admin-packs/admin-packs.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BotResponsesModule } from './modules/bot-responses/bot-responses.module.js';
import { CardMarketModule } from './modules/card-market/card-market.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LeagueModule } from './modules/league/league.module.js';
import { LucroModule } from './modules/lucro/lucro.module.js';
import { MissionsModule } from './modules/missions/missions.module.js';
import { PacksModule } from './modules/packs/packs.module.js';

@Module({
  imports: [
    AuthModule,
    BotResponsesModule,
    AdminCardsModule,
    AdminPacksModule,
    CardMarketModule,
    FilesModule,
    HealthModule,
    LeagueModule,
    LucroModule,
    MissionsModule,
    PacksModule,
  ],
})
export class AppModule {}
