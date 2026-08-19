import { SwaggerCustomizer, TypedBody, TypedRoute } from '@nestia/core';
import { Controller, HttpCode, Inject, Param, UseGuards } from '@nestjs/common';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import type { OpenPackResponse, PackActionRequest, PurchasePackResponse } from './packs.dto.js';
import { OpenPackUseCase, PurchasePackUseCase } from './packs.use-case.js';

@Controller('v1/packs')
@UseGuards(InternalAuthGuard)
export class PacksController {
  constructor(
    @Inject(PurchasePackUseCase) private readonly purchase: PurchasePackUseCase,
    @Inject(OpenPackUseCase) private readonly open: OpenPackUseCase,
  ) {}

  @TypedRoute.Post(':packId/purchase')
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'purchasePack';
    route.security = [{ bearer: [] }];
  })
  purchasePack(
    @Param('packId') packId: string,
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
    @Param('packId') packId: string,
    @TypedBody() request: PackActionRequest,
  ): Promise<OpenPackResponse> {
    const result = await this.open.execute(request.identity, packId);
    return { cards: [...result.cards], progression: result.progression };
  }
}
