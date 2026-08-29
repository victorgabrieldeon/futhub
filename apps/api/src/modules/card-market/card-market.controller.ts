import { SwaggerCustomizer, TypedBody, TypedRoute } from '@nestia/core';
import { Controller, HttpCode, Inject, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import type {
  PurchaseCardRequest,
  PurchaseCardResponse,
  SellCardsRequest,
  SellCardsResponse,
} from './card-market.dto.js';
import { PurchaseCardUseCase, SellCardsUseCase } from './use-cases/card-market.use-case.js';

@ApiTags('Mercado de cards')
@Controller('v1/cards')
@UseGuards(InternalAuthGuard)
export class CardMarketController {
  constructor(
    @Inject(PurchaseCardUseCase) private readonly purchase: PurchaseCardUseCase,
    @Inject(SellCardsUseCase) private readonly sell: SellCardsUseCase,
  ) {}

  @TypedRoute.Post(':cardId/purchase')
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'purchaseCard';
    route.security = [{ bearer: [] }];
  })
  purchaseCard(
    @Param('cardId') cardId: string,
    @TypedBody() request: PurchaseCardRequest,
  ): Promise<PurchaseCardResponse> {
    return this.purchase.execute(request.identity, cardId);
  }

  @TypedRoute.Post('sell')
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'sellCards';
    route.security = [{ bearer: [] }];
  })
  async sellCards(@TypedBody() request: SellCardsRequest): Promise<SellCardsResponse> {
    const result = await this.sell.execute(request.identity, request.userCardIds);
    return { ...result, userCardIds: [...result.userCardIds] };
  }
}
