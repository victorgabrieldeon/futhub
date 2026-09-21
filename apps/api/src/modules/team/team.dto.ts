import { z } from 'zod';

import {
  type CardMarketIdentity,
  CardMarketIdentitySchema,
  type CardMarketPosition,
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

export interface TeamCollection {
  id: string;
  name: string;
  emoji: string;
}
export interface TeamFormationSlot {
  id: string;
  position: CardMarketPosition;
  x: number;
  y: number;
}
export interface TeamFormation {
  id: string;
  name: string;
  slots: TeamFormationSlot[];
}
export interface TeamCard {
  userCardId: string;
  name: string;
  imageUrl: string | null;
  overall: number;
  position: CardMarketPosition;
  secondaryPositions: CardMarketPosition[];
  collection: TeamCollection;
  favorite: boolean;
  holder: boolean;
  holderPosition: CardMarketPosition | null;
  captain: boolean;
  sellPrice: number;
  claimedAt: string;
}
export interface TeamInventory {
  items: TeamCard[];
  total: number;
  page: number;
  pageSize: 10;
  totalPages: number;
}
export interface TeamPack {
  id: string;
  name: string;
  emoji: string;
  quantity: number;
}
export interface TeamResponse {
  balance: number;
  strength: number;
  inventoryCount: number;
  tactic: TeamTactic;
  formation: TeamFormation;
  formations: TeamFormation[];
  lineup: TeamCard[];
  inventory: TeamInventory;
  packs: TeamPack[];
  collections: TeamCollection[];
}

export type TeamIdentity = CardMarketIdentity;
