import { SwaggerCustomizer, TypedRoute } from '@nestia/core';
import { Body, Controller, HttpCode, Inject, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import { type ClubRequest, ClubRequestSchema, type ClubResponse } from './club.dto.js';
import { ClubService } from './club.service.js';

@ApiTags('Clube')
@Controller('v1/club')
@UseGuards(InternalAuthGuard)
export class ClubController {
  constructor(@Inject(ClubService) private readonly club: ClubService) {}

  @TypedRoute.Post()
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'getClub';
    route.security = [{ bearer: [] }];
  })
  get(@Body({ schema: ClubRequestSchema }) identity: ClubRequest): Promise<ClubResponse> {
    return this.club.get(identity);
  }

  @TypedRoute.Post('stadium/upgrade')
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'upgradeStadium';
    route.security = [{ bearer: [] }];
  })
  upgradeStadium(
    @Body({ schema: ClubRequestSchema }) identity: ClubRequest,
  ): Promise<ClubResponse> {
    return this.club.upgradeStadium(identity);
  }
}
