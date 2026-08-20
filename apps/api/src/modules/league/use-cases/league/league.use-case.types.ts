import type {
  LeagueStatusResponse,
  MatchEventDto,
  MatchResponse,
  QueueResponse,
} from '../../league.dto.js';

export type DiscordIdentity = Readonly<{ id: string; name: string; avatarUrl: string | null }>;

export class LeagueInputError extends Error {}
export class LeagueNotFoundError extends Error {}

export abstract class LeagueRepository {
  abstract join(identity: DiscordIdentity): Promise<QueueResponse>;
  abstract status(discordUserId: string): Promise<QueueResponse | null>;
  abstract standings(discordUserId: string): Promise<LeagueStatusResponse>;
  abstract match(matchId: string): Promise<MatchResponse>;
  abstract events(matchId: string): Promise<MatchEventDto[]>;
}
