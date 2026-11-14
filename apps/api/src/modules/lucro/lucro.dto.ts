import { z } from 'zod';

import { CompletedMissionDtoSchema } from '../missions/missions.dto.js';
import { ProgressionDtoSchema } from '../progression/progression.dto.js';

export const LucroEmbedDtoSchema = z.object({
  title: z.string(),
  description: z.string(),
  color: z.string(),
  footer: z.string(),
});
export type LucroEmbedDto = z.infer<typeof LucroEmbedDtoSchema>;

// Mesmo schema da liga: um único objeto para o componente `DiscordIdentityDto` do OpenAPI.
export { type DiscordIdentityDto, DiscordIdentityDtoSchema } from '../league/league.dto.js';

export const LucroRewardDtoSchema = z.object({
  value: z.number(),
  weight: z.number(),
  message: z.string(),
});
export type LucroRewardDto = z.infer<typeof LucroRewardDtoSchema>;

export const LucroReportDtoSchema = z.object({
  ticketRevenue: z.number().int(),
  commercialRevenue: z.number().int(),
  sponsorRevenue: z.number().int(),
  maintenance: z.number().int(),
  payroll: z.number().int(),
  net: z.number().int(),
});

export const LucroSuccessResponseSchema = z.object({
  kind: z.enum(['success']),
  reward: LucroRewardDtoSchema,
  report: LucroReportDtoSchema,
  balance: z.number(),
  availableAt: z.iso.datetime(),
  progression: ProgressionDtoSchema,
  completedMissions: z.array(CompletedMissionDtoSchema),
  embed: LucroEmbedDtoSchema,
});
export type LucroSuccessResponse = z.infer<typeof LucroSuccessResponseSchema>;

export const LucroCooldownResponseSchema = z.object({
  kind: z.enum(['cooldown']),
  availableAt: z.iso.datetime(),
});
export type LucroCooldownResponse = z.infer<typeof LucroCooldownResponseSchema>;

export const LucroResponseSchema = z
  .discriminatedUnion('kind', [LucroSuccessResponseSchema, LucroCooldownResponseSchema])
  .meta({ id: 'LucroResponse' });
export type LucroResponse = z.infer<typeof LucroResponseSchema>;
