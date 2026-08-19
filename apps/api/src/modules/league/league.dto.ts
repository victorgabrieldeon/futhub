import type { tags } from 'typia';

export interface DiscordIdentityDto {
  id: string & tags.MinLength<1> & tags.MaxLength<80>;
  name: string & tags.MinLength<1> & tags.MaxLength<80>;
  avatarUrl: (string & tags.Format<'url'> & tags.MaxLength<2048>) | null;
}

export type QueueResponse = QueueWaitingResponse | QueueMatchedResponse;

export interface QueueWaitingResponse {
  kind: 'waiting';
  division: LeagueDivisionDto;
}

export interface QueueMatchedResponse {
  kind: 'matched';
  matchId: string & tags.Format<'uuid'>;
}

export interface LeagueDivisionDto {
  id: string & tags.Format<'uuid'>;
  name: string;
  minimumPoints: number;
  emoji: string;
  color: string | null;
  imageUrl: string | null;
}

export interface LeagueStatusResponse {
  points: number;
  wins: number;
  draws: number;
  losses: number;
  division: LeagueDivisionDto;
  queue: QueueResponse | null;
}

export interface MatchEventDto {
  sequence: number;
  minute: number;
  type: 'kickoff' | 'goal' | 'yellow_card' | 'red_card' | 'fulltime';
  playerUserCardId: (string & tags.Format<'uuid'>) | null;
  assistUserCardId: (string & tags.Format<'uuid'>) | null;
  description: string;
  homeGoals: number;
  awayGoals: number;
}

export interface MatchResponse {
  id: string & tags.Format<'uuid'>;
  homeUserId: string & tags.Format<'uuid'>;
  awayUserId: string & tags.Format<'uuid'>;
  homeGoals: number;
  awayGoals: number;
  completedAt: string & tags.Format<'date-time'>;
  events: MatchEventDto[];
}
