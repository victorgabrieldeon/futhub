import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { type Observable, from } from 'rxjs';

import { PlayerOrInternalAuthGuard } from '../auth/player-auth.guard.js';
import {
  type DiscordIdentityDto,
  DiscordIdentityDtoSchema,
  type LeagueStatusResponse,
  LeagueStatusResponseSchema,
  type MatchEventDto,
  type MatchResponse,
  MatchResponseSchema,
  type QueueResponse,
  QueueResponseSchema,
  type TestMatchRequest,
  TestMatchRequestSchema,
  type TestMatchResponse,
  TestMatchResponseSchema,
} from './league.dto.js';
import { LeagueUseCase } from './use-cases/league/league.use-case.js';
import { LeagueInputError, LeagueNotFoundError } from './use-cases/league/league.use-case.types.js';

@ApiTags('Liga')
@Controller('v1')
@UseGuards(PlayerOrInternalAuthGuard)
export class LeagueController {
  constructor(@Inject(LeagueUseCase) private readonly league: LeagueUseCase) {}

  @Post('league')
  @ApiOperation({ operationId: 'getLeague', summary: 'Lê a divisão e a classificação do jogador' })
  @HttpCode(200)
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ standardSchema: LeagueStatusResponseSchema })
  async open(
    @Body({ schema: DiscordIdentityDtoSchema }) identity: DiscordIdentityDto,
  ): Promise<LeagueStatusResponse> {
    return this.handle(() => this.league.open(identity));
  }

  @Post('ranked/queue')
  @ApiOperation({ operationId: 'joinRankedQueue', summary: 'Entra na fila da partida ranqueada' })
  @HttpCode(200)
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ standardSchema: QueueResponseSchema })
  async join(
    @Body({ schema: DiscordIdentityDtoSchema }) identity: DiscordIdentityDto,
  ): Promise<QueueResponse> {
    return this.handle(() => this.league.join(identity));
  }

  @Get('ranked/status/:discordUserId')
  @ApiOperation({
    operationId: 'getRankedStatus',
    summary: 'Lê o estado do jogador na fila ranqueada',
  })
  @ApiOkResponse({ standardSchema: QueueResponseSchema.nullable() })
  async status(@Param('discordUserId') discordUserId: string): Promise<QueueResponse | null> {
    return this.handle(() => this.league.status(discordUserId));
  }

  @Get('league/:discordUserId')
  @ApiOperation({
    operationId: 'getLeagueStatus',
    summary: 'Lê a divisão e a classificação de um jogador',
  })
  @ApiOkResponse({ standardSchema: LeagueStatusResponseSchema })
  async standings(@Param('discordUserId') discordUserId: string): Promise<LeagueStatusResponse> {
    return this.handle(() => this.league.standings(discordUserId));
  }

  @Post('matches/test')
  @ApiOperation({ operationId: 'simulateTestMatch', summary: 'Simula um amistoso contra a CPU' })
  @HttpCode(200)
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ standardSchema: TestMatchResponseSchema })
  async testMatch(
    @Body({ schema: TestMatchRequestSchema }) input: TestMatchRequest,
  ): Promise<TestMatchResponse> {
    return this.handle(() =>
      this.league.testMatch(
        input.identity,
        input.opponentId ?? null,
        input.seed ?? null,
        input.difficulty,
      ),
    );
  }

  @Get('matches/:matchId')
  @ApiOperation({ operationId: 'getMatch', summary: 'Lê o resultado e os eventos de uma partida' })
  @ApiOkResponse({ standardSchema: MatchResponseSchema })
  async match(@Param('matchId') matchId: string): Promise<MatchResponse> {
    return this.handle(() => this.league.match(matchId));
  }

  @Sse('matches/:matchId/events')
  @ApiExcludeEndpoint()
  async events(
    @Param('matchId') matchId: string,
  ): Promise<Observable<{ data: MatchEventDto; id: string; type: string }>> {
    const events = await this.handle(() => this.league.events(matchId));
    return from(
      events.map((event) => ({ data: event, id: String(event.sequence), type: event.type })),
    );
  }

  private async handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof LeagueInputError) throw new BadRequestException(error.message);
      if (error instanceof LeagueNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
