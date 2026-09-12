import { z } from 'zod';

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
