import { Module } from '@nestjs/common';

import { AdminLucroController } from './admin-lucro.controller.js';
import { AdminLucroService } from './admin-lucro.service.js';
import { LucroController } from './lucro.controller.js';
import { DrizzleResgatarLucroRepository } from './repository/resgatar-lucro.repository.js';
import {
  Clock,
  RandomSource,
  ResgatarLucroRepository,
} from './use-cases/resgatar-lucro/resgatar-lucro.types.js';
import { ResgatarLucroUseCase } from './use-cases/resgatar-lucro/resgatar-lucro.use-case.js';

@Module({
  controllers: [LucroController, AdminLucroController],
  providers: [
    { provide: Clock, useValue: { now: () => new Date() } },
    { provide: RandomSource, useValue: { next: () => Math.random() } },
    AdminLucroService,
    {
      provide: ResgatarLucroRepository,
      useFactory: () => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        return new DrizzleResgatarLucroRepository(() => import('@futhub/database'));
      },
    },
    {
      provide: ResgatarLucroUseCase,
      inject: [ResgatarLucroRepository, Clock, RandomSource],
      useFactory: (repository: ResgatarLucroRepository, clock: Clock, random: RandomSource) =>
        new ResgatarLucroUseCase(repository, clock, random),
    },
  ],
})
export class LucroModule {}
