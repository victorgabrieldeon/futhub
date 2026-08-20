import {
  BadRequestException,
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { SwaggerCustomizer, TypedBody, TypedRoute } from '@nestia/core';
import { from, type Observable } from 'rxjs';

import { InternalAuthGuard } from '../auth/internal-auth.guard.js';
import type {
  DiscordIdentityDto,
  LeagueStatusResponse,
  MatchEventDto,
  MatchResponse,
  QueueResponse,
} from './league.dto.js';
import { LeagueInputError, LeagueNotFoundError } from './use-cases/league/league.use-case.types.js';
import { LeagueUseCase } from './use-cases/league/league.use-case.js';

@Controller('v1')
@UseGuards(InternalAuthGuard)
export class LeagueController {
  constructor(@Inject(LeagueUseCase) private readonly league: LeagueUseCase) {}

  @TypedRoute.Post('ranked/queue')
  @HttpCode(200)
  @SwaggerCustomizer(({ route }) => {
    route.operationId = 'joinRankedQueue';
    route.security = [{ bearer: [] }];
  })
  async join(@TypedBody() identity: DiscordIdentityDto): Promise<QueueResponse> {
    return this.handle(() => this.league.join(identity));
  }

  @TypedRoute.Get('ranked/status/:discordUserId')
  async status(@Param('discordUserId') discordUserId: string): Promise<QueueResponse | null> {
    return this.handle(() => this.league.status(discordUserId));
  }

  @TypedRoute.Get('league/:discordUserId')
  async standings(@Param('discordUserId') discordUserId: string): Promise<LeagueStatusResponse> {
    return this.handle(() => this.league.standings(discordUserId));
  }

  @TypedRoute.Get('matches/:matchId')
  async match(@Param('matchId') matchId: string): Promise<MatchResponse> {
    return this.handle(() => this.league.match(matchId));
  }

  @Sse('matches/:matchId/events')
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
