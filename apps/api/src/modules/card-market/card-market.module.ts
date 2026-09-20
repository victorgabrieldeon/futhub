import { Module } from '@nestjs/common';

import { FilesService } from '../files/files.service.js';
import { CardMarketController } from './card-market.controller.js';
import { DrizzleCardMarketRepository } from './repository/card-market.repository.js';
import { CardMarketRepository } from './use-cases/card-market.types.js';
import {
  ListCardCatalogUseCase,
  ListCardsUseCase,
  PurchaseCardUseCase,
  SellCardsUseCase,
} from './use-cases/card-market.use-case.js';

@Module({
  controllers: [CardMarketController],
  providers: [
    {
      provide: CardMarketRepository,
      inject: [FilesService],
      useFactory: (files: FilesService) => {
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
        return new DrizzleCardMarketRepository(() => import('@futhub/database'), files);
      },
    },
    {
      provide: ListCardsUseCase,
      inject: [CardMarketRepository],
      useFactory: (repository: CardMarketRepository) => new ListCardsUseCase(repository),
    },
    {
      provide: ListCardCatalogUseCase,
      inject: [CardMarketRepository],
      useFactory: (repository: CardMarketRepository) => new ListCardCatalogUseCase(repository),
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
