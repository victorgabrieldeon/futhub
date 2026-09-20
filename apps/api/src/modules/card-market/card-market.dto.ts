import { z } from 'zod';

export const CardMarketPositionSchema = z.enum([
  'GOL',
  'LD',
  'LE',
  'ZAG',
  'VOL',
  'MA',
  'MC',
  'PD',
  'PE',
  'CA',
]);
export type CardMarketPosition = z.infer<typeof CardMarketPositionSchema>;

const CardMarketPositionsQuerySchema = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => {
    const values = typeof value === 'string' ? [value] : value;
    return [...new Set(values.flatMap((position) => position.split(',')))];
  })
  .pipe(z.array(CardMarketPositionSchema).min(1).max(10));

export const CardMarketListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    positions: CardMarketPositionsQuerySchema.optional(),
    minOverall: z.coerce.number().int().min(60).max(100).default(60),
    maxOverall: z.coerce.number().int().min(60).max(100).default(100),
    teamId: z.uuid().optional(),
    collectionId: z.uuid().optional(),
    sort: z.enum(['recent', 'overall', 'name']).default('recent'),
  })
  .refine((query) => query.minOverall <= query.maxOverall, {
    message: 'minOverall must be less than or equal to maxOverall.',
    path: ['minOverall'],
  });
export type CardMarketListQuery = z.infer<typeof CardMarketListQuerySchema>;

export const CardMarketCatalogOptionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  emoji: z.string(),
});
export type CardMarketCatalogOption = z.infer<typeof CardMarketCatalogOptionSchema>;

export const CardMarketItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  imageUrl: z.url(),
  overall: z.number(),
  position: CardMarketPositionSchema,
  secondaryPositions: z.array(CardMarketPositionSchema),
  defense: z.number(),
  attack: z.number(),
  creation: z.number(),
  passing: z.number(),
  control: z.number(),
  marking: z.number(),
  pace: z.number(),
  dribbling: z.number(),
  finishing: z.number(),
  price: z.number(),
  team: CardMarketCatalogOptionSchema,
  collection: CardMarketCatalogOptionSchema,
});
export type CardMarketItem = z.infer<typeof CardMarketItemSchema>;

export const CardMarketPageSchema = z.object({
  items: z.array(CardMarketItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.literal(10),
  totalPages: z.number(),
});
export type CardMarketPage = z.infer<typeof CardMarketPageSchema>;

export const CardMarketCatalogSchema = z.object({
  teams: z.array(CardMarketCatalogOptionSchema),
  collections: z.array(CardMarketCatalogOptionSchema),
});
export type CardMarketCatalog = z.infer<typeof CardMarketCatalogSchema>;

export const CardMarketIdentitySchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  avatarUrl: z.url().max(2048).nullable(),
});
export type CardMarketIdentity = z.infer<typeof CardMarketIdentitySchema>;

export const PurchaseCardRequestSchema = z.object({ identity: CardMarketIdentitySchema });
export type PurchaseCardRequest = z.infer<typeof PurchaseCardRequestSchema>;

export const PurchaseCardResponseSchema = z.object({
  userCardId: z.string(),
  balance: z.number(),
  price: z.number(),
});
export type PurchaseCardResponse = z.infer<typeof PurchaseCardResponseSchema>;

export const SellCardsRequestSchema = z.object({
  identity: CardMarketIdentitySchema,
  userCardIds: z.array(z.uuid()).min(1),
});
export type SellCardsRequest = z.infer<typeof SellCardsRequestSchema>;

export const SellCardsResponseSchema = z.object({
  userCardIds: z.array(z.string()),
  balance: z.number(),
  amount: z.number(),
});
export type SellCardsResponse = z.infer<typeof SellCardsResponseSchema>;
