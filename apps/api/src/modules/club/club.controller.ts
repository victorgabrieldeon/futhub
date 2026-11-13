import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlayerOrInternalAuthGuard } from '../auth/player-auth.guard.js';
import {
  type ClubRequest,
  ClubRequestSchema,
  type ClubResponse,
  ClubResponseSchema,
} from './club.dto.js';
import { ClubService } from './club.service.js';

@ApiTags('Clube')
@ApiBearerAuth('bearer')
@Controller('v1/club')
@UseGuards(PlayerOrInternalAuthGuard)
export class ClubController {
  constructor(@Inject(ClubService) private readonly club: ClubService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ operationId: 'getClub' })
  @ApiOkResponse({ standardSchema: ClubResponseSchema })
  get(@Body({ schema: ClubRequestSchema }) identity: ClubRequest): Promise<ClubResponse> {
    return this.club.get(identity);
  }

  @Post('stadium/upgrade')
  @HttpCode(200)
  @ApiOperation({ operationId: 'upgradeStadium' })
  @ApiOkResponse({ standardSchema: ClubResponseSchema })
  upgradeStadium(
    @Body({ schema: ClubRequestSchema }) identity: ClubRequest,
  ): Promise<ClubResponse> {
    return this.club.upgradeStadium(identity);
  }
}
