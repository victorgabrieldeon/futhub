import { z } from 'zod';

import { CompletedMissionDtoSchema } from '../missions/missions.dto.js';
import { ProgressionDtoSchema } from '../progression/progression.dto.js';

const packIdentitySchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  avatarUrl: z.url().max(2048).nullable(),
});

export const PackActionRequestSchema = z.object({ identity: packIdentitySchema });
export type PackActionRequest = z.infer<typeof PackActionRequestSchema>;

export const PackCatalogItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    emoji: z.string(),
    cardsAmount: z.number().int().positive(),
    price: z.number().int().nonnegative(),
    limitPerUser: z.number().int().nonnegative(),
    imageUrl: z.string().nullable(),
  })
  .meta({ id: 'PackCatalogItem' });
export type PackCatalogItem = z.infer<typeof PackCatalogItemSchema>;

export const PackShopItemDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  price: z.number(),
  imageUrl: z.string(),
  cardsPerPack: z.number(),
});
export type PackShopItemDto = z.infer<typeof PackShopItemDtoSchema>;

export const PackShopDtoSchema = z.object({
  packs: z.array(PackShopItemDtoSchema),
  page: z.number(),
  totalPages: z.number(),
});
export type PackShopDto = z.infer<typeof PackShopDtoSchema>;

export const PackShopQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});
export type PackShopQuery = z.infer<typeof PackShopQuerySchema>;

export const PurchasePackResponseSchema = z
  .object({
    balance: z.number(),
    quantity: z.number(),
    completedMissions: z.array(CompletedMissionDtoSchema),
  })
  .meta({ id: 'PurchasePackResponse' });
export type PurchasePackResponse = z.infer<typeof PurchasePackResponseSchema>;

export const OpenPackResponseSchema = z
  .object({
    cards: z.array(
      z.object({
        id: z.string(),
        card: z.object({
          id: z.string(),
          overall: z.number(),
          name: z.string(),
          position: z.string(),
          imageUrl: z.string().nullable(),
          team: z.object({ name: z.string(), emoji: z.string() }),
          collection: z.object({ name: z.string(), emoji: z.string() }),
        }),
      }),
    ),
    progression: ProgressionDtoSchema,
    completedMissions: z.array(CompletedMissionDtoSchema),
  })
  .meta({ id: 'OpenPackResponse' });
export type OpenPackResponse = z.infer<typeof OpenPackResponseSchema>;
