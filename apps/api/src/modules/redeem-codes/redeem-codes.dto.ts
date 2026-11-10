import { z } from 'zod';

import { DiscordIdentityDtoSchema } from '../lucro/lucro.dto.js';

export const RedeemRewardTypeSchema = z.enum(['card', 'pack', 'balance', 'field']);
export type RedeemRewardTypeDto = z.infer<typeof RedeemRewardTypeSchema>;

export const ResgatarCodigoInputSchema = z.object({
  identity: DiscordIdentityDtoSchema,
  code: z.string().min(1).max(100),
});
export type ResgatarCodigoInputDto = z.infer<typeof ResgatarCodigoInputSchema>;

export const RedeemRewardDtoSchema = z.object({
  itemId: z.uuid(),
  type: RedeemRewardTypeSchema,
  quantity: z.number().int().min(1),
  resourceId: z.uuid().nullable(),
  resourceName: z.string().nullable(),
});
export type RedeemRewardDto = z.infer<typeof RedeemRewardDtoSchema>;

export const ResgatarCodigoResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.enum(['success']),
    code: z.string(),
    reward: RedeemRewardDtoSchema,
    balance: z.number().int(),
  }),
  z.object({
    kind: z.enum(['rejected']),
    reason: z.enum([
      'not_found',
      'inactive',
      'expired',
      'already_redeemed',
      'exhausted',
      'inventory_full',
    ]),
  }),
]);
export type ResgatarCodigoResponse = z.infer<typeof ResgatarCodigoResponseSchema>;

export const AdminRedeemCodeInputSchema = z.object({
  code: z.string().min(1).max(100),
  reward: z.object({
    type: RedeemRewardTypeSchema,
    amount: z.number().int().min(1).max(1_000_000),
    resourceId: z.uuid().nullable(),
  }),
  maxClaims: z.number().int().min(1).nullable(),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  active: z.boolean(),
});
export type AdminRedeemCodeInput = z.infer<typeof AdminRedeemCodeInputSchema>;

export const AdminRedeemCodeSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  active: z.boolean(),
  maxClaims: z.number().int().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  claims: z.number().int().min(0),
  /** Code and reward are immutable once the first Resgate happened. */
  locked: z.boolean(),
  reward: z.object({
    itemId: z.uuid(),
    type: RedeemRewardTypeSchema,
    amount: z.number().int().min(1),
    resourceId: z.uuid().nullable(),
    resourceName: z.string().nullable(),
  }),
});
export type AdminRedeemCode = z.infer<typeof AdminRedeemCodeSchema>;

const ResourceOptionSchema = z.object({ id: z.uuid(), name: z.string() });

export const AdminRedeemCodeOptionsSchema = z.object({
  cards: z.array(ResourceOptionSchema),
  packs: z.array(ResourceOptionSchema),
  fields: z.array(ResourceOptionSchema),
});
export type AdminRedeemCodeOptions = z.infer<typeof AdminRedeemCodeOptionsSchema>;
