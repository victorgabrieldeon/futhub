import { z } from 'zod';

export const AdminUserListQuerySchema = z.object({
  query: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;

export const AdminUserSummarySchema = z.object({
  id: z.uuid(),
  discordUserId: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  balance: z.number().int(),
  level: z.number().int(),
  xp: z.number().int(),
  booster: z.boolean(),
  banned: z.boolean(),
  cardCount: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AdminUserSummary = z.infer<typeof AdminUserSummarySchema>;

export const AdminUserPageSchema = z.object({
  items: z.array(AdminUserSummarySchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type AdminUserPage = z.infer<typeof AdminUserPageSchema>;

export const AdminUserCardSchema = z.object({
  id: z.uuid(),
  cardId: z.uuid(),
  name: z.string(),
  overall: z.number().int(),
  position: z.string(),
  holder: z.boolean(),
  captain: z.boolean(),
  favorite: z.boolean(),
  /** Cards referenced by a trade keep that history and cannot be removed. */
  inTrade: z.boolean(),
  claimedBy: z.string(),
  claimedAt: z.iso.datetime(),
});
export type AdminUserCard = z.infer<typeof AdminUserCardSchema>;

export const AdminUserPackSchema = z.object({
  packId: z.uuid(),
  name: z.string(),
  quantity: z.number().int().min(0),
});
export type AdminUserPack = z.infer<typeof AdminUserPackSchema>;

export const AdminUserFieldSchema = z.object({ fieldId: z.uuid(), name: z.string() });
export type AdminUserField = z.infer<typeof AdminUserFieldSchema>;

export const AdminUserTransactionSchema = z.object({
  id: z.uuid(),
  type: z.string(),
  amount: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type AdminUserTransaction = z.infer<typeof AdminUserTransactionSchema>;

export const AdminUserDetailSchema = AdminUserSummarySchema.extend({
  language: z.string(),
  nextLevelXp: z.number().int().min(1),
  maxCards: z.number().int().min(0),
  stadiumLevel: z.number().int().nullable(),
  cards: z.array(AdminUserCardSchema),
  packs: z.array(AdminUserPackSchema),
  fields: z.array(AdminUserFieldSchema),
  /** Most recent balance movements, newest first. */
  transactions: z.array(AdminUserTransactionSchema),
});
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

export const AdminUserProfileInputSchema = z.object({
  level: z.number().int().min(1).max(1_000),
  xp: z.number().int().min(0),
  booster: z.boolean(),
  banned: z.boolean(),
});
export type AdminUserProfileInput = z.infer<typeof AdminUserProfileInputSchema>;

export const AdminUserBalanceInputSchema = z.object({
  /** Signed adjustment applied atomically on top of the current balance. */
  amount: z
    .number()
    .int()
    .min(-100_000_000)
    .max(100_000_000)
    .refine((amount) => amount !== 0, 'O ajuste não pode ser zero.'),
});
export type AdminUserBalanceInput = z.infer<typeof AdminUserBalanceInputSchema>;

export const AdminUserCardsInputSchema = z.object({
  cardId: z.uuid(),
  quantity: z.number().int().min(1).max(100),
});
export type AdminUserCardsInput = z.infer<typeof AdminUserCardsInputSchema>;

export const AdminUserPackInputSchema = z.object({
  /** Absolute quantity owned; zero removes the Pack from the inventory. */
  quantity: z.number().int().min(0).max(100_000),
});
export type AdminUserPackInput = z.infer<typeof AdminUserPackInputSchema>;

const ResourceOptionSchema = z.object({ id: z.uuid(), name: z.string() });

export const AdminUserOptionsSchema = z.object({
  cards: z.array(ResourceOptionSchema),
  packs: z.array(ResourceOptionSchema),
  fields: z.array(ResourceOptionSchema),
});
export type AdminUserOptions = z.infer<typeof AdminUserOptionsSchema>;
