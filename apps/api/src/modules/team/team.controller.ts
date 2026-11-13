import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlayerOrInternalAuthGuard } from '../auth/player-auth.guard.js';
import {
  type SetCaptainRequest,
  SetCaptainRequestSchema,
  type SetFormationRequest,
  SetFormationRequestSchema,
  type SetLineupCardRequest,
  SetLineupCardRequestSchema,
  type SetTacticRequest,
  SetTacticRequestSchema,
  type TeamIdentityRequest,
  TeamIdentityRequestSchema,
  type TeamResponse,
  TeamResponseSchema,
  type TeamViewRequest,
  TeamViewRequestSchema,
} from './team.dto.js';
import { TeamInputError, TeamService } from './team.service.js';

@ApiTags('Time')
@ApiBearerAuth('bearer')
@Controller('v1/team')
@UseGuards(PlayerOrInternalAuthGuard)
export class TeamController {
  constructor(@Inject(TeamService) private readonly team: TeamService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ operationId: 'getTeam' })
  @ApiOkResponse({ standardSchema: TeamResponseSchema })
  view(@Body({ schema: TeamViewRequestSchema }) request: TeamViewRequest): Promise<TeamResponse> {
    return this.handle(() => this.team.view(request));
  }

  @Put('formation')
  @HttpCode(204)
  @ApiOperation({ operationId: 'setTeamFormation' })
  setFormation(
    @Body({ schema: SetFormationRequestSchema }) request: SetFormationRequest,
  ): Promise<void> {
    return this.handle(() => this.team.setFormation(request.identity, request.formationId));
  }

  @Put('tactic')
  @HttpCode(204)
  @ApiOperation({ operationId: 'setTeamTactic' })
  setTactic(@Body({ schema: SetTacticRequestSchema }) request: SetTacticRequest): Promise<void> {
    return this.handle(() => this.team.setTactic(request.identity, request.tactic));
  }

  @Post('lineup/auto')
  @HttpCode(204)
  @ApiOperation({ operationId: 'autoSelectTeamLineup' })
  autoLineup(
    @Body({ schema: TeamIdentityRequestSchema }) request: TeamIdentityRequest,
  ): Promise<void> {
    return this.handle(() => this.team.autoSelect(request.identity));
  }

  @Put('lineup')
  @HttpCode(204)
  @ApiOperation({ operationId: 'setTeamLineupCard' })
  setLineupCard(
    @Body({ schema: SetLineupCardRequestSchema }) request: SetLineupCardRequest,
  ): Promise<void> {
    return this.handle(() => this.team.setLineupCard(request));
  }

  @Put('captain')
  @HttpCode(204)
  @ApiOperation({ operationId: 'setTeamCaptain' })
  setCaptain(@Body({ schema: SetCaptainRequestSchema }) request: SetCaptainRequest): Promise<void> {
    return this.handle(() => this.team.setCaptain(request.identity, request.userCardId));
  }

  @Put('cards/:userCardId/favorite')
  @HttpCode(204)
  @ApiOperation({ operationId: 'toggleTeamCardFavorite' })
  toggleFavorite(
    @Param('userCardId') userCardId: string,
    @Body({ schema: TeamIdentityRequestSchema }) request: TeamIdentityRequest,
  ): Promise<void> {
    return this.handle(() => this.team.toggleFavorite(request.identity, userCardId));
  }

  private async handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof TeamInputError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
