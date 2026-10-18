import type {
  CpuDifficulty,
  LeagueStatusResponse,
  MatchEventDto,
  MatchResponse,
  QueueResponse,
  TestMatchResponse,
} from '../../league.dto.js';
import {
  type DiscordIdentity,
  LeagueInputError,
  type LeagueRepository,
} from './league.use-case.types.js';

export class LeagueUseCase {
  constructor(private readonly repository: LeagueRepository) {}
  open(identity: DiscordIdentity): Promise<LeagueStatusResponse> {
    return this.repository.open(identity);
  }

  join(identity: DiscordIdentity): Promise<QueueResponse> {
    return this.repository.join(identity);
  }

  status(discordUserId: string): Promise<QueueResponse | null> {
    return this.repository.status(discordUserId);
  }

  standings(discordUserId: string): Promise<LeagueStatusResponse> {
    return this.repository.standings(discordUserId);
  }

  match(matchId: string): Promise<MatchResponse> {
    return this.repository.match(matchId);
  }

  events(matchId: string): Promise<MatchEventDto[]> {
    return this.repository.events(matchId);
  }

  testMatch(
    identity: DiscordIdentity,
    opponentId: string | null,
    seed: number | null,
    difficulty: CpuDifficulty = 'medium',
  ): Promise<TestMatchResponse> {
    if (opponentId === identity.id)
      throw new LeagueInputError('Escolha outro jogador como adversário.');
    return this.repository.testMatch(
      identity,
      opponentId,
      seed ?? Math.floor(Math.random() * 2_147_483_647) + 1,
      difficulty,
    );
  }
}
