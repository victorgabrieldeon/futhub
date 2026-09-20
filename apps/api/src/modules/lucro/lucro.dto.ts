import { z } from 'zod';

import { ProgressionDtoSchema } from '../progression/progression.dto.js';

export const LucroEmbedDtoSchema = z.object({
  title: z.string(),
  description: z.string(),
  color: z.string(),
  footer: z.string(),
});
export type LucroEmbedDto = z.infer<typeof LucroEmbedDtoSchema>;

export const DiscordIdentityDtoSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  avatarUrl: z.url().max(2048).nullable(),
});
export type DiscordIdentityDto = z.infer<typeof DiscordIdentityDtoSchema>;

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
  embed: LucroEmbedDtoSchema,
});
export type LucroSuccessResponse = z.infer<typeof LucroSuccessResponseSchema>;

export const LucroCooldownResponseSchema = z.object({
  kind: z.enum(['cooldown']),
  availableAt: z.iso.datetime(),
});
export type LucroCooldownResponse = z.infer<typeof LucroCooldownResponseSchema>;

export const LucroResponseSchema = z.discriminatedUnion('kind', [
  LucroSuccessResponseSchema,
  LucroCooldownResponseSchema,
]);
export type LucroResponse = z.infer<typeof LucroResponseSchema>;
