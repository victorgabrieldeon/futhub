import { SwaggerCustomizer, TypedRoute } from '@nestia/core';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
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
  type TeamViewRequest,
  TeamViewRequestSchema,
} from './team.dto.js';
import { TeamInputError, TeamService } from './team.service.js';

@ApiTags('Time')
@Controller('v1/team')
@UseGuards(InternalAuthGuard)
export class TeamController {
  constructor(@Inject(TeamService) private readonly team: TeamService) {}

  @TypedRoute.Post()
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'getTeam';
    route.security = [{ bearer: [] }];
  })
  view(@Body({ schema: TeamViewRequestSchema }) request: TeamViewRequest): Promise<TeamResponse> {
    return this.handle(() => this.team.view(request));
  }

  @TypedRoute.Put('formation')
  @HttpCode(204)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'setTeamFormation';
    route.security = [{ bearer: [] }];
  })
  setFormation(
    @Body({ schema: SetFormationRequestSchema }) request: SetFormationRequest,
  ): Promise<void> {
    return this.handle(() => this.team.setFormation(request.identity, request.formationId));
  }

  @TypedRoute.Put('tactic')
  @HttpCode(204)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'setTeamTactic';
    route.security = [{ bearer: [] }];
  })
  setTactic(@Body({ schema: SetTacticRequestSchema }) request: SetTacticRequest): Promise<void> {
    return this.handle(() => this.team.setTactic(request.identity, request.tactic));
  }

  @TypedRoute.Post('lineup/auto')
  @HttpCode(204)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'autoSelectTeamLineup';
    route.security = [{ bearer: [] }];
  })
  autoLineup(
    @Body({ schema: TeamIdentityRequestSchema }) request: TeamIdentityRequest,
  ): Promise<void> {
    return this.handle(() => this.team.autoSelect(request.identity));
  }

  @TypedRoute.Put('lineup')
  @HttpCode(204)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'setTeamLineupCard';
    route.security = [{ bearer: [] }];
  })
  setLineupCard(
    @Body({ schema: SetLineupCardRequestSchema }) request: SetLineupCardRequest,
  ): Promise<void> {
    return this.handle(() => this.team.setLineupCard(request));
  }

  @TypedRoute.Put('captain')
  @HttpCode(204)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'setTeamCaptain';
    route.security = [{ bearer: [] }];
  })
  setCaptain(@Body({ schema: SetCaptainRequestSchema }) request: SetCaptainRequest): Promise<void> {
    return this.handle(() => this.team.setCaptain(request.identity, request.userCardId));
  }

  @TypedRoute.Put('cards/:userCardId/favorite')
  @HttpCode(204)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'toggleTeamCardFavorite';
    route.security = [{ bearer: [] }];
  })
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
