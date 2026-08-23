import { SwaggerCustomizer, TypedBody, TypedRoute } from '@nestia/core';
import { Controller, HttpCode, Inject, UseGuards } from '@nestjs/common';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import type { AdminLucroConfigResponse, UpdateLucroConfigRequest } from './lucro.dto.js';
import { LucroConfigService } from './lucro-config.service.js';

@Controller('v1/admin/lucro')
@UseGuards(InternalAuthGuard)
export class AdminLucroController {
  constructor(@Inject(LucroConfigService) private readonly lucroConfig: LucroConfigService) {}

  @TypedRoute.Get()
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'getAdminLucroConfig';
    route.security = [{ bearer: [] }];
  })
  get(): Promise<AdminLucroConfigResponse> {
    return this.lucroConfig.get();
  }

  @TypedRoute.Put()
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'updateAdminLucroConfig';
    route.security = [{ bearer: [] }];
  })
  update(@TypedBody() request: UpdateLucroConfigRequest): Promise<AdminLucroConfigResponse> {
    return this.lucroConfig.replace(request);
  }
}
