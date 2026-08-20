import type {
  LeagueStatusResponse,
  MatchEventDto,
  MatchResponse,
  QueueResponse,
} from '../../league.dto.js';
import type { DiscordIdentity, LeagueRepository } from './league.use-case.types.js';

export class LeagueUseCase {
  constructor(private readonly repository: LeagueRepository) {}

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
}
