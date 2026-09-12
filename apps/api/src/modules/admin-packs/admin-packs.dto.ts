import { z } from 'zod';

export const PackPositionSchema = z.enum([
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
export type PackPosition = z.infer<typeof PackPositionSchema>;

export const AdminPackConfigInputSchema = z.object({
  name: z.string().max(100).nullable(),
  minOverall: z.number().int().min(60).max(100),
  maxOverall: z.number().int().min(60).max(100),
  onlyPositions: z.array(PackPositionSchema),
  excludedPositions: z.array(PackPositionSchema),
  onlyCollectionIds: z.array(z.uuid()),
  excludedCollectionIds: z.array(z.uuid()),
  onlyCardIds: z.array(z.uuid()),
  excludedCardIds: z.array(z.uuid()),
  onlyTeamIds: z.array(z.uuid()),
  excludedTeamIds: z.array(z.uuid()),
});
export type AdminPackConfigInput = z.infer<typeof AdminPackConfigInputSchema>;

export const AdminPackInputSchema = z.object({
  name: z.string().min(1).max(100),
  imageUrl: z.url().max(2048).nullable(),
  color: z.string().min(1).max(16),
  emoji: z.string().min(1).max(255),
  cardsAmount: z.number().int().min(1),
  price: z.number().int().min(0),
  canBuy: z.boolean(),
  limitPerUser: z.number().int().min(0),
  config: AdminPackConfigInputSchema,
});
export type AdminPackInput = z.infer<typeof AdminPackInputSchema>;

export const AdminPackConfigSchema = AdminPackConfigInputSchema.extend({ id: z.string() });
export type AdminPackConfig = z.infer<typeof AdminPackConfigSchema>;

export const AdminPackSchema = AdminPackInputSchema.omit({ config: true }).extend({
  id: z.string(),
  config: AdminPackConfigSchema,
});
export type AdminPack = z.infer<typeof AdminPackSchema>;
