import { z } from 'zod';

import { ProgressionDtoSchema } from '../progression/progression.dto.js';

const packIdentitySchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  avatarUrl: z.url().max(2048).nullable(),
});

export const PackActionRequestSchema = z.object({ identity: packIdentitySchema });
export type PackActionRequest = z.infer<typeof PackActionRequestSchema>;

export const PurchasePackResponseSchema = z.object({
  balance: z.number(),
  quantity: z.number(),
});
export type PurchasePackResponse = z.infer<typeof PurchasePackResponseSchema>;

export const OpenPackResponseSchema = z.object({
  cards: z.array(
    z.object({ id: z.string(), card: z.object({ id: z.string(), overall: z.number() }) }),
  ),
  progression: ProgressionDtoSchema,
});
export type OpenPackResponse = z.infer<typeof OpenPackResponseSchema>;
