import { Module } from '@nestjs/common';

import { LeagueController } from './league.controller.js';
import { DrizzleLeagueRepository } from './league.repository.js';

@Module({
  controllers: [LeagueController],
  providers: [
    {
      provide: DrizzleLeagueRepository,
      useFactory: () => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        // Database module validates DATABASE_URL during import, after application bootstrap.
        return new DrizzleLeagueRepository(() => import('@dreamfut/database'));
      },
    },
  ],
})
export class LeagueModule {}
