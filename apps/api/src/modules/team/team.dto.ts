import { z } from 'zod';

import {
  type CardMarketIdentity,
  CardMarketIdentitySchema,
  CardMarketPositionSchema,
} from '../card-market/card-market.dto.js';

export const TeamTacticSchema = z.enum(['defensive', 'balanced', 'offensive']);
export type TeamTactic = z.infer<typeof TeamTacticSchema>;

export const TeamViewRequestSchema = z.object({
  identity: CardMarketIdentitySchema,
  page: z.number().int().min(1).default(1),
  name: z.string().trim().max(80).default(''),
  position: CardMarketPositionSchema.nullable().default(null),
  collectionId: z.uuid().nullable().default(null),
  sort: z.enum(['overall', 'name', 'recent']).default('overall'),
  /** Mantém só cartas que podem ser vendidas: reservas não favoritas com preço. */
  sellable: z.boolean().default(false),
});
export type TeamViewRequest = z.infer<typeof TeamViewRequestSchema>;

export const TeamIdentityRequestSchema = z.object({ identity: CardMarketIdentitySchema });
export type TeamIdentityRequest = z.infer<typeof TeamIdentityRequestSchema>;

export const SetFormationRequestSchema = TeamIdentityRequestSchema.extend({
  formationId: z.uuid(),
});
export type SetFormationRequest = z.infer<typeof SetFormationRequestSchema>;

export const SetTacticRequestSchema = TeamIdentityRequestSchema.extend({
  tactic: TeamTacticSchema,
});
export type SetTacticRequest = z.infer<typeof SetTacticRequestSchema>;

export const SetLineupCardRequestSchema = TeamIdentityRequestSchema.extend({
  userCardId: z.uuid(),
  position: CardMarketPositionSchema,
});
export type SetLineupCardRequest = z.infer<typeof SetLineupCardRequestSchema>;

export const SetCaptainRequestSchema = TeamIdentityRequestSchema.extend({
  userCardId: z.uuid(),
});
export type SetCaptainRequest = z.infer<typeof SetCaptainRequestSchema>;

/** Time real da carta (clube do jogador), não o clube do usuário. */
export const TeamClubSchema = z
  .object({ name: z.string(), emoji: z.string() })
  .meta({ id: 'TeamClub' });
export type TeamClub = z.infer<typeof TeamClubSchema>;

export const TeamCollectionSchema = z
  .object({ id: z.string(), name: z.string(), emoji: z.string() })
  .meta({ id: 'TeamCollection' });
export type TeamCollection = z.infer<typeof TeamCollectionSchema>;

export const TeamFormationSlotSchema = z
  .object({ id: z.string(), position: CardMarketPositionSchema, x: z.number(), y: z.number() })
  .meta({ id: 'TeamFormationSlot' });
export type TeamFormationSlot = z.infer<typeof TeamFormationSlotSchema>;

export const TeamFormationSchema = z
  .object({ id: z.string(), name: z.string(), slots: z.array(TeamFormationSlotSchema) })
  .meta({ id: 'TeamFormation' });
export type TeamFormation = z.infer<typeof TeamFormationSchema>;

export const TeamCardSchema = z
  .object({
    userCardId: z.string(),
    name: z.string(),
    imageUrl: z.string().nullable(),
    overall: z.number(),
    position: CardMarketPositionSchema,
    secondaryPositions: z.array(CardMarketPositionSchema),
    team: TeamClubSchema,
    collection: TeamCollectionSchema,
    favorite: z.boolean(),
    holder: z.boolean(),
    holderPosition: CardMarketPositionSchema.nullable(),
    captain: z.boolean(),
    sellPrice: z.number(),
    claimedAt: z.string(),
  })
  .meta({ id: 'TeamCard' });
export type TeamCard = z.infer<typeof TeamCardSchema>;

export const TeamInventorySchema = z
  .object({
    items: z.array(TeamCardSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.literal(10),
    totalPages: z.number(),
  })
  .meta({ id: 'TeamInventory' });
export type TeamInventory = z.infer<typeof TeamInventorySchema>;

export const TeamPackSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    emoji: z.string(),
    cardsAmount: z.number(),
    imageUrl: z.string().nullable(),
    quantity: z.number(),
  })
  .meta({ id: 'TeamPack' });
export type TeamPack = z.infer<typeof TeamPackSchema>;

export const TeamProfileSchema = z
  .object({ level: z.number(), xp: z.number(), nextLevelXp: z.number() })
  .meta({ id: 'TeamProfile' });
export type TeamProfile = z.infer<typeof TeamProfileSchema>;

export const TeamProfitSchema = z
  .object({
    availableAt: z
      .string()
      .nullable()
      .describe('Quando o próximo lucro libera; `null` se já pode ser resgatado.'),
  })
  .meta({ id: 'TeamProfit' });
export type TeamProfit = z.infer<typeof TeamProfitSchema>;

export const TeamResponseSchema = z
  .object({
    balance: z.number(),
    strength: z.number(),
    inventoryCount: z.number(),
    tactic: TeamTacticSchema,
    formation: TeamFormationSchema,
    formations: z.array(TeamFormationSchema),
    lineup: z.array(TeamCardSchema),
    inventory: TeamInventorySchema,
    packs: z.array(TeamPackSchema),
    collections: z.array(TeamCollectionSchema),
    profile: TeamProfileSchema,
    profit: TeamProfitSchema,
  })
  .meta({ id: 'TeamResponse' });
export type TeamResponse = z.infer<typeof TeamResponseSchema>;

export type TeamIdentity = CardMarketIdentity;
