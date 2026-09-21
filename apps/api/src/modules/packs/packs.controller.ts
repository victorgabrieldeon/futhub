import { SwaggerCustomizer, TypedRoute } from '@nestia/core';
import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import {
  type OpenPackResponse,
  type PackActionRequest,
  PackActionRequestSchema,
  type PackCatalogItem,
  type PackShopDto,
  type PackShopItemDto,
  type PackShopQuery,
  PackShopQuerySchema,
  type PurchasePackResponse,
} from './packs.dto.js';
import { PackShopService } from './pack-shop.service.js';
import { OpenPackUseCase } from './use-cases/open-pack/open-pack.use-case.js';
import { PackCatalogRepository } from './use-cases/pack.types.js';
import { PurchasePackUseCase } from './use-cases/purchase-pack/purchase-pack.use-case.js';

@ApiTags('Packs')
@Controller('v1/packs')
@UseGuards(InternalAuthGuard)
export class PacksController {
  constructor(
    @Inject(PackCatalogRepository) private readonly packs: PackCatalogRepository,
    @Inject(PurchasePackUseCase) private readonly purchase: PurchasePackUseCase,
    @Inject(OpenPackUseCase) private readonly open: OpenPackUseCase,
    @Inject(PackShopService) private readonly shop: PackShopService,
  ) {}

  @TypedRoute.Get()
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'listPackCatalog';
    route.security = [{ bearer: [] }];
  })
  listPacks(): Promise<readonly PackCatalogItem[]> {
    return this.packs.listAvailable();
  }

  @TypedRoute.Get('shop')
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'getPackShop';
    route.security = [{ bearer: [] }];
  })
  getPackShop(@Query({ schema: PackShopQuerySchema }) query: PackShopQuery): Promise<PackShopDto> {
    return this.shop.list(query.page ?? 1);
  }

  @TypedRoute.Get(':packId')
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'inspectPack';
    route.security = [{ bearer: [] }];
  })
  inspectPack(@Param('packId', new ParseUUIDPipe()) packId: string): Promise<PackShopItemDto> {
    return this.shop.inspect(packId);
  }

  @TypedRoute.Post(':packId/purchase')
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'purchasePack';
    route.security = [{ bearer: [] }];
  })
  purchasePack(
    @Param('packId', new ParseUUIDPipe()) packId: string,
    @Body({ schema: PackActionRequestSchema }) request: PackActionRequest,
  ): Promise<PurchasePackResponse> {
    return this.purchase.execute(request.identity, packId);
  }

  @TypedRoute.Post(':packId/open')
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'openPack';
    route.security = [{ bearer: [] }];
  })
  async openPack(
    @Param('packId', new ParseUUIDPipe()) packId: string,
    @Body({ schema: PackActionRequestSchema }) request: PackActionRequest,
  ): Promise<OpenPackResponse> {
    const result = await this.open.execute(request.identity, packId);
    return { cards: [...result.cards], progression: result.progression };
  }
}
