import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { PlayerOrInternalAuthGuard } from '../auth/player-auth.guard.js';
import { PackShopService } from './pack-shop.service.js';
import {
  type OpenPackResponse,
  OpenPackResponseSchema,
  type PackActionRequest,
  PackActionRequestSchema,
  type PackCatalogItem,
  PackCatalogItemSchema,
  type PackShopDto,
  PackShopDtoSchema,
  type PackShopItemDto,
  PackShopItemDtoSchema,
  type PackShopQuery,
  PackShopQuerySchema,
  type PurchasePackResponse,
  PurchasePackResponseSchema,
} from './packs.dto.js';
import { OpenPackUseCase } from './use-cases/open-pack/open-pack.use-case.js';
import { PackCatalogRepository } from './use-cases/pack.types.js';
import { PurchasePackUseCase } from './use-cases/purchase-pack/purchase-pack.use-case.js';

@ApiTags('Packs')
@ApiBearerAuth('bearer')
@Controller('v1/packs')
@UseGuards(PlayerOrInternalAuthGuard)
export class PacksController {
  constructor(
    @Inject(PackCatalogRepository) private readonly packs: PackCatalogRepository,
    @Inject(PurchasePackUseCase) private readonly purchase: PurchasePackUseCase,
    @Inject(OpenPackUseCase) private readonly open: OpenPackUseCase,
    @Inject(PackShopService) private readonly shop: PackShopService,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listPackCatalog' })
  @ApiOkResponse({ standardSchema: z.array(PackCatalogItemSchema) })
  async listPacks(): Promise<PackCatalogItem[]> {
    return [...(await this.packs.listAvailable())];
  }

  @Get('shop')
  @ApiOperation({ operationId: 'getPackShop' })
  @ApiOkResponse({ standardSchema: PackShopDtoSchema })
  getPackShop(@Query({ schema: PackShopQuerySchema }) query: PackShopQuery): Promise<PackShopDto> {
    return this.shop.list(query.page ?? 1);
  }

  @Get(':packId')
  @ApiOperation({ operationId: 'inspectPack' })
  @ApiOkResponse({ standardSchema: PackShopItemDtoSchema })
  inspectPack(@Param('packId', new ParseUUIDPipe()) packId: string): Promise<PackShopItemDto> {
    return this.shop.inspect(packId);
  }

  @Post(':packId/purchase')
  @HttpCode(200)
  @ApiOperation({ operationId: 'purchasePack' })
  @ApiOkResponse({ standardSchema: PurchasePackResponseSchema })
  async purchasePack(
    @Param('packId', new ParseUUIDPipe()) packId: string,
    @Body({ schema: PackActionRequestSchema }) request: PackActionRequest,
  ): Promise<PurchasePackResponse> {
    const result = await this.purchase.execute(request.identity, packId);
    return { ...result, completedMissions: [...result.completedMissions] };
  }

  @Post(':packId/open')
  @HttpCode(200)
  @ApiOperation({ operationId: 'openPack' })
  @ApiOkResponse({ standardSchema: OpenPackResponseSchema })
  async openPack(
    @Param('packId', new ParseUUIDPipe()) packId: string,
    @Body({ schema: PackActionRequestSchema }) request: PackActionRequest,
  ): Promise<OpenPackResponse> {
    const result = await this.open.execute(request.identity, packId);
    return {
      cards: [...result.cards],
      progression: result.progression,
      completedMissions: [...result.completedMissions],
    };
  }
}
