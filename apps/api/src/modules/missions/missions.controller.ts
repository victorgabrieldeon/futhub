import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlayerOrInternalAuthGuard } from '../auth/player-auth.guard.js';
import {
  type MissionsRequest,
  MissionsRequestSchema,
  type MissionsResponse,
  MissionsResponseSchema,
} from './missions.dto.js';
import { MissionsService } from './missions.service.js';

@ApiTags('Missões')
@ApiBearerAuth('bearer')
@Controller('v1/missions')
@UseGuards(PlayerOrInternalAuthGuard)
export class MissionsController {
  constructor(@Inject(MissionsService) private readonly missions: MissionsService) {}

  @Post()
  @ApiOperation({ operationId: 'listMissions', summary: 'Lista as missões do jogador' })
  @HttpCode(200)
  @ApiOkResponse({ standardSchema: MissionsResponseSchema })
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
