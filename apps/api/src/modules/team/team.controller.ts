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
  @ApiOperation({
    operationId: 'getTeam',
    summary: 'Lê elenco, escalação, formação e inventário do jogador',
  })
  @HttpCode(200)
  @ApiOkResponse({ standardSchema: TeamResponseSchema })
  view(@Body({ schema: TeamViewRequestSchema }) request: TeamViewRequest): Promise<TeamResponse> {
    return this.handle(() => this.team.view(request));
  }

  @Put('formation')
  @ApiOperation({ operationId: 'setTeamFormation', summary: 'Troca a formação do time' })
  @HttpCode(204)
  setFormation(
    @Body({ schema: SetFormationRequestSchema }) request: SetFormationRequest,
  ): Promise<void> {
    return this.handle(() => this.team.setFormation(request.identity, request.formationId));
  }

  @Put('tactic')
  @ApiOperation({ operationId: 'setTeamTactic', summary: 'Troca a tática do time' })
  @HttpCode(204)
  setTactic(@Body({ schema: SetTacticRequestSchema }) request: SetTacticRequest): Promise<void> {
    return this.handle(() => this.team.setTactic(request.identity, request.tactic));
  }

  @Post('lineup/auto')
  @ApiOperation({
    operationId: 'autoSelectTeamLineup',
    summary: 'Escala automaticamente os melhores titulares',
  })
  @HttpCode(204)
  autoLineup(
    @Body({ schema: TeamIdentityRequestSchema }) request: TeamIdentityRequest,
  ): Promise<void> {
    return this.handle(() => this.team.autoSelect(request.identity));
  }

  @Put('lineup')
  @ApiOperation({ operationId: 'setTeamLineupCard', summary: 'Escala um Card numa posição' })
  @HttpCode(204)
  setLineupCard(
    @Body({ schema: SetLineupCardRequestSchema }) request: SetLineupCardRequest,
  ): Promise<void> {
    return this.handle(() => this.team.setLineupCard(request));
  }

  @Put('captain')
  @ApiOperation({ operationId: 'setTeamCaptain', summary: 'Define o capitão do time' })
  @HttpCode(204)
  setCaptain(@Body({ schema: SetCaptainRequestSchema }) request: SetCaptainRequest): Promise<void> {
    return this.handle(() => this.team.setCaptain(request.identity, request.userCardId));
  }

  @Put('cards/:userCardId/favorite')
  @ApiOperation({
    operationId: 'toggleTeamCardFavorite',
    summary: 'Marca ou desmarca um Card como favorito',
  })
  @HttpCode(204)
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
