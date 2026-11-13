import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { type HealthResponse, HealthResponseSchema } from './health.dto.js';

@ApiTags('Saúde')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ operationId: 'HealthController_health' })
  @ApiOkResponse({ standardSchema: HealthResponseSchema })
  health(): HealthResponse {
    return { status: 'ok' };
  }
}
