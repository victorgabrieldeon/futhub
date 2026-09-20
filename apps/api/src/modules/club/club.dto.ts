import { z } from 'zod';

import { DiscordIdentityDtoSchema } from '../lucro/lucro.dto.js';

export const ClubRequestSchema = DiscordIdentityDtoSchema;
export type ClubRequest = z.infer<typeof ClubRequestSchema>;

export const StadiumDtoSchema = z.object({
  level: z.number().int(),
  maxLevel: z.number().int(),
  nextUpgradeCost: z.number().int().nullable(),
  ticketRevenue: z.number().int(),
  maintenance: z.number().int(),
});

export const SponsorDtoSchema = z.object({
  name: z.string(),
  weeklyMatches: z.number().int(),
  weeklyGoal: z.number().int(),
  payout: z.number().int(),
  completed: z.boolean(),
});

export const ClubResponseSchema = z.object({
  balance: z.number().int(),
  stadium: StadiumDtoSchema,
  sponsor: SponsorDtoSchema,
  payroll: z.number().int(),
  projectedNet: z.number().int(),
});
export type ClubResponse = z.infer<typeof ClubResponseSchema>;
