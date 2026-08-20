import { Module } from '@nestjs/common';

import { LeagueController } from './league.controller.js';
import { DrizzleLeagueRepository } from './repository/league.repository.js';
import { LeagueRepository } from './use-cases/league/league.use-case.types.js';
import { LeagueUseCase } from './use-cases/league/league.use-case.js';

@Module({
  controllers: [LeagueController],
  providers: [
    {
      provide: LeagueRepository,
      useFactory: () => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        // Database module validates DATABASE_URL during import, after application bootstrap.
        return new DrizzleLeagueRepository(() => import('@dreamfut/database'));
      },
    },
    {
      provide: LeagueUseCase,
      inject: [LeagueRepository],
      useFactory: (repository: LeagueRepository) => new LeagueUseCase(repository),
    },
  ],
})
export class LeagueModule {}
