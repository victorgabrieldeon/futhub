import { SwaggerCustomizer, TypedRoute } from '@nestia/core';
import { Body, Controller, HttpCode, Inject, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import {
  type MissionsRequest,
  MissionsRequestSchema,
  type MissionsResponse,
} from './missions.dto.js';
import { MissionsService } from './missions.service.js';

@ApiTags('Missões')
@Controller('v1/missions')
@UseGuards(InternalAuthGuard)
export class MissionsController {
  constructor(@Inject(MissionsService) private readonly missions: MissionsService) {}

  @TypedRoute.Post()
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'listMissions';
    route.security = [{ bearer: [] }];
  })
  async list(
    @Body({ schema: MissionsRequestSchema }) identity: MissionsRequest,
  ): Promise<MissionsResponse> {
    const missions = await this.missions.list(identity);
    return {
      missions: missions.map((mission) => ({
        ...mission,
        expiresAt: mission.expiresAt.toISOString(),
      })),
    };
  }
}
