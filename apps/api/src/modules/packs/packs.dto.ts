import { z } from 'zod';

import { ProgressionDtoSchema } from '../progression/progression.dto.js';

const packIdentitySchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  avatarUrl: z.url().max(2048).nullable(),
});

export const PackActionRequestSchema = z.object({ identity: packIdentitySchema });
export type PackActionRequest = z.infer<typeof PackActionRequestSchema>;

export const PackCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  cardsAmount: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  limitPerUser: z.number().int().nonnegative(),
});
export type PackCatalogItem = z.infer<typeof PackCatalogItemSchema>;

export type PackShopItemDto = Readonly<{
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  cardsPerPack: number;
}>;

export type PackShopDto = Readonly<{
  packs: PackShopItemDto[];
  page: number;
  totalPages: number;
}>;

export const PackShopQuerySchema = z.object({ page: z.coerce.number().int().min(1).optional() });
export type PackShopQuery = z.infer<typeof PackShopQuerySchema>;

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
