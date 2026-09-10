import { Module } from '@nestjs/common';

import { AuthModule } from './modules/auth/auth.module.js';
import { AdminCardsModule } from './modules/admin-cards/admin-cards.module.js';
import { CardMarketModule } from './modules/card-market/card-market.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LeagueModule } from './modules/league/league.module.js';
import { LucroModule } from './modules/lucro/lucro.module.js';
import { MissionsModule } from './modules/missions/missions.module.js';
import { PacksModule } from './modules/packs/packs.module.js';

@Module({
  imports: [
    AuthModule,
    AdminCardsModule,
    CardMarketModule,
    HealthModule,
    LeagueModule,
    LucroModule,
    MissionsModule,
    PacksModule,
  ],
})
export class AppModule {}
