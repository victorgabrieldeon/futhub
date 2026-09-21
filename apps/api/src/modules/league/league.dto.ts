import { z } from 'zod';

export const DiscordIdentityDtoSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  avatarUrl: z.url().max(2048).nullable(),
});
export type DiscordIdentityDto = z.infer<typeof DiscordIdentityDtoSchema>;

export const LeagueDivisionDtoSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  minimumPoints: z.number(),
  emoji: z.string(),
  color: z.string().nullable(),
  imageUrl: z.string().nullable(),
});
export type LeagueDivisionDto = z.infer<typeof LeagueDivisionDtoSchema>;

export const QueueWaitingResponseSchema = z.object({
  kind: z.enum(['waiting']),
  division: LeagueDivisionDtoSchema,
});
export type QueueWaitingResponse = z.infer<typeof QueueWaitingResponseSchema>;

export const QueueMatchedResponseSchema = z.object({
  kind: z.enum(['matched']),
  matchId: z.uuid(),
});
export type QueueMatchedResponse = z.infer<typeof QueueMatchedResponseSchema>;

export const QueueResponseSchema = z.discriminatedUnion('kind', [
  QueueWaitingResponseSchema,
  QueueMatchedResponseSchema,
]);
export type QueueResponse = z.infer<typeof QueueResponseSchema>;

export const LeagueStatusResponseSchema = z.object({
  points: z.number(),
  wins: z.number(),
  draws: z.number(),
  losses: z.number(),
  division: LeagueDivisionDtoSchema,
  queue: QueueResponseSchema.nullable(),
});
export type LeagueStatusResponse = z.infer<typeof LeagueStatusResponseSchema>;

export const MatchEventDtoSchema = z.object({
  sequence: z.number(),
  minute: z.number(),
  type: z.enum(['kickoff', 'goal', 'yellow_card', 'red_card', 'fulltime']),
  playerUserCardId: z.uuid().nullable(),
  assistUserCardId: z.uuid().nullable(),
  description: z.string(),
  homeGoals: z.number(),
  awayGoals: z.number(),
});
export type MatchEventDto = z.infer<typeof MatchEventDtoSchema>;

export const MatchResponseSchema = z.object({
  id: z.uuid(),
  home: DiscordIdentityDtoSchema,
  away: DiscordIdentityDtoSchema,
  homeGoals: z.number(),
  awayGoals: z.number(),
  completedAt: z.iso.datetime(),
  events: z.array(MatchEventDtoSchema),
});
export type MatchResponse = z.infer<typeof MatchResponseSchema>;
