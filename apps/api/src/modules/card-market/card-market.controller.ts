import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlayerOrInternalAuthGuard } from '../auth/player-auth.guard.js';
import {
  type CardMarketCatalog,
  CardMarketCatalogSchema,
  type CardMarketListQuery,
  CardMarketListQuerySchema,
  type CardMarketPage,
  CardMarketPageSchema,
  type PurchaseCardRequest,
  PurchaseCardRequestSchema,
  type PurchaseCardResponse,
  PurchaseCardResponseSchema,
  type SellCardsRequest,
  SellCardsRequestSchema,
  type SellCardsResponse,
  SellCardsResponseSchema,
} from './card-market.dto.js';
import {
  ListCardCatalogUseCase,
  ListCardsUseCase,
  PurchaseCardUseCase,
  SellCardsUseCase,
} from './use-cases/card-market.use-case.js';

@ApiTags('Mercado de cards')
@ApiBearerAuth('bearer')
@Controller('v1/cards')
@UseGuards(PlayerOrInternalAuthGuard)
export class CardMarketController {
  constructor(
    @Inject(ListCardsUseCase) private readonly list: ListCardsUseCase,
    @Inject(ListCardCatalogUseCase) private readonly catalog: ListCardCatalogUseCase,
    @Inject(PurchaseCardUseCase) private readonly purchase: PurchaseCardUseCase,
    @Inject(SellCardsUseCase) private readonly sell: SellCardsUseCase,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listCardMarket' })
  @ApiOkResponse({ standardSchema: CardMarketPageSchema })
  listCards(
    @Query({ schema: CardMarketListQuerySchema }) query: CardMarketListQuery,
  ): Promise<CardMarketPage> {
    return this.list.execute(query);
  }

  @Get('catalog')
  @ApiOperation({ operationId: 'listCardMarketCatalog' })
  @ApiOkResponse({ standardSchema: CardMarketCatalogSchema })
  listCatalog(): Promise<CardMarketCatalog> {
    return this.catalog.execute();
  }

  @Post(':cardId/purchase')
  @HttpCode(200)
  @ApiOperation({ operationId: 'purchaseCard' })
  @ApiOkResponse({ standardSchema: PurchaseCardResponseSchema })
  async purchaseCard(
    @Param('cardId') cardId: string,
    @Body({ schema: PurchaseCardRequestSchema }) request: PurchaseCardRequest,
  ): Promise<PurchaseCardResponse> {
    const result = await this.purchase.execute(request.identity, cardId);
    return { ...result, completedMissions: [...result.completedMissions] };
  }

  @Post('sell')
  @HttpCode(200)
  @ApiOperation({ operationId: 'sellCards' })
  @ApiOkResponse({ standardSchema: SellCardsResponseSchema })
  async sellCards(
    @Body({ schema: SellCardsRequestSchema }) request: SellCardsRequest,
  ): Promise<SellCardsResponse> {
    const result = await this.sell.execute(request.identity, request.userCardIds);
    return {
      ...result,
      userCardIds: [...result.userCardIds],
      completedMissions: [...result.completedMissions],
    };
  }
}
