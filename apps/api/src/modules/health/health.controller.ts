import { SwaggerCustomizer, TypedRoute } from '@nestia/core';
import { Controller } from '@nestjs/common';

interface HealthResponse {
  /**
   * Estado atual do serviço.
   *
   * @title Estado do serviço
   */
  status: 'ok';
}

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
