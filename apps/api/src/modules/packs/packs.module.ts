import { Module } from '@nestjs/common';

import { PacksController } from './packs.controller.js';
import { DrizzlePackRepository } from './repository/packs.repository.js';
import { PackRepository } from './packs.types.js';
import { OpenPackUseCase, PurchasePackUseCase } from './packs.use-case.js';

@Module({
  controllers: [PacksController],
  providers: [
    {
      provide: PackRepository,
      useFactory: () => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        return new DrizzlePackRepository(() => import('@dreamfut/database'));
      },
    },
    {
      provide: PurchasePackUseCase,
      inject: [PackRepository],
      useFactory: (repository: PackRepository) => new PurchasePackUseCase(repository),
    },
    {
      provide: OpenPackUseCase,
      inject: [PackRepository],
      useFactory: (repository: PackRepository) => new OpenPackUseCase(repository, Math.random),
    },
  ],
})
export class PacksModule {}
