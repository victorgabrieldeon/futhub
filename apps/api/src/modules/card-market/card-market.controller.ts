import { SwaggerCustomizer, TypedRoute } from '@nestia/core';
import { Body, Controller, HttpCode, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import {
  type CardMarketCatalog,
  type CardMarketListQuery,
  CardMarketListQuerySchema,
  type CardMarketPage,
  type PurchaseCardRequest,
  PurchaseCardRequestSchema,
  type PurchaseCardResponse,
  type SellCardsRequest,
  SellCardsRequestSchema,
  type SellCardsResponse,
} from './card-market.dto.js';
import {
  ListCardCatalogUseCase,
  ListCardsUseCase,
  PurchaseCardUseCase,
  SellCardsUseCase,
} from './use-cases/card-market.use-case.js';

@ApiTags('Mercado de cards')
@Controller('v1/cards')
@UseGuards(InternalAuthGuard)
export class CardMarketController {
  constructor(
    @Inject(ListCardsUseCase) private readonly list: ListCardsUseCase,
    @Inject(ListCardCatalogUseCase) private readonly catalog: ListCardCatalogUseCase,
    @Inject(PurchaseCardUseCase) private readonly purchase: PurchaseCardUseCase,
    @Inject(SellCardsUseCase) private readonly sell: SellCardsUseCase,
  ) {}

  @TypedRoute.Get()
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'listCardMarket';
    route.security = [{ bearer: [] }];
  })
  listCards(
    @Query({ schema: CardMarketListQuerySchema }) query: CardMarketListQuery,
  ): Promise<CardMarketPage> {
    return this.list.execute(query);
  }

  @TypedRoute.Get('catalog')
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'listCardMarketCatalog';
    route.security = [{ bearer: [] }];
  })
  listCatalog(): Promise<CardMarketCatalog> {
    return this.catalog.execute();
  }

  @TypedRoute.Post(':cardId/purchase')
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'purchaseCard';
    route.security = [{ bearer: [] }];
  })
  purchaseCard(
    @Param('cardId') cardId: string,
    @Body({ schema: PurchaseCardRequestSchema }) request: PurchaseCardRequest,
  ): Promise<PurchaseCardResponse> {
    return this.purchase.execute(request.identity, cardId);
  }

  @TypedRoute.Post('sell')
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'sellCards';
    route.security = [{ bearer: [] }];
  })
  async sellCards(
    @Body({ schema: SellCardsRequestSchema }) request: SellCardsRequest,
  ): Promise<SellCardsResponse> {
    const result = await this.sell.execute(request.identity, request.userCardIds);
    return { ...result, userCardIds: [...result.userCardIds] };
  }
}
