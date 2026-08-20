import { Module } from '@nestjs/common';

import { CardMarketController } from './card-market.controller.js';
import { DrizzleCardMarketRepository } from './repository/card-market.repository.js';
import { CardMarketRepository } from './use-cases/card-market.types.js';
import { PurchaseCardUseCase, SellCardsUseCase } from './use-cases/card-market.use-case.js';

@Module({
  controllers: [CardMarketController],
  providers: [
    {
      provide: CardMarketRepository,
      useFactory: () => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        return new DrizzleCardMarketRepository(() => import('@dreamfut/database'));
      },
    },
    {
      provide: PurchaseCardUseCase,
      inject: [CardMarketRepository],
      useFactory: (repository: CardMarketRepository) => new PurchaseCardUseCase(repository),
    },
    {
      provide: SellCardsUseCase,
      inject: [CardMarketRepository],
      useFactory: (repository: CardMarketRepository) => new SellCardsUseCase(repository),
    },
  ],
})
export class CardMarketModule {}
