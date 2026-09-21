import { SwaggerCustomizer, TypedRoute } from '@nestia/core';
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import type { HealthResponse } from './health.dto.js';

@ApiTags('Saúde')
@Controller()
export class HealthController {
  @TypedRoute.Get('health')
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'HealthController_health';
  })
  health(): HealthResponse {
    return { status: 'ok' };
  }
}
