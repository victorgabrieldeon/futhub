import { SwaggerCustomizer, TypedBody, TypedParam, TypedQuery, TypedRoute } from '@nestia/core';
import { Controller, HttpCode, Inject, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { tags } from 'typia';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import { PackShopService } from './pack-shop.service.js';
import type {
  OpenPackResponse,
  PackActionRequest,
  PackShopDto,
  PackShopItemDto,
  PackShopQueryDto,
  PurchasePackResponse,
} from './packs.dto.js';
import { OpenPackUseCase } from './use-cases/open-pack/open-pack.use-case.js';
import { PurchasePackUseCase } from './use-cases/purchase-pack/purchase-pack.use-case.js';

@ApiTags('Packs')
@Controller('v1/packs')
@UseGuards(InternalAuthGuard)
export class PacksController {
  constructor(
    @Inject(PurchasePackUseCase) private readonly purchase: PurchasePackUseCase,
    @Inject(OpenPackUseCase) private readonly open: OpenPackUseCase,
    @Inject(PackShopService) private readonly shop: PackShopService,
  ) {}

  @TypedRoute.Get('shop')
  @SwaggerCustomizer(({ route, swagger }) => {
    route.operationId = 'getPackShop';
    route.security = [{ bearer: [] }];
    // Nestia emits an empty required array; OpenAPI 3.0 requires its omission.
    const query = swagger.components.schemas?.PackShopQueryDto;
    if (query && 'required' in query && query.required?.length === 0) query.required = undefined;
  })
  getPackShop(@TypedQuery() query: PackShopQueryDto): Promise<PackShopDto> {
    return this.shop.list(query.page ?? 1);
  }

  @TypedRoute.Get(':packId')
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'inspectPack';
    route.security = [{ bearer: [] }];
  })
  inspectPack(
    @TypedParam('packId') packId: string & tags.Format<'uuid'>,
  ): Promise<PackShopItemDto> {
    return this.shop.inspect(packId);
  }

  @TypedRoute.Post(':packId/purchase')
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'purchasePack';
    route.security = [{ bearer: [] }];
  })
  purchasePack(
    @TypedParam('packId') packId: string & tags.Format<'uuid'>,
    @TypedBody() request: PackActionRequest,
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
    @TypedParam('packId') packId: string & tags.Format<'uuid'>,
    @TypedBody() request: PackActionRequest,
  ): Promise<OpenPackResponse> {
    const result = await this.open.execute(request.identity, packId);
    return { cards: [...result.cards], progression: result.progression };
  }
}
