import { z } from 'zod';

export const MissionsRequestSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  avatarUrl: z.url().max(2048).nullable(),
});
export type MissionsRequest = z.infer<typeof MissionsRequestSchema>;

export const MissionRewardDtoSchema = z.object({
  itemId: z.uuid(),
  type: z.enum(['card', 'pack', 'balance', 'field', 'premium']),
  quantity: z.number().min(1),
  resourceId: z.uuid().nullable(),
});
export type MissionRewardDto = z.infer<typeof MissionRewardDtoSchema>;

export const MissionTypeSchema = z.enum([
  'open_pack',
  'sell_player',
  'claim_profit',
  'play_match',
  'buy_pack',
  'buy_player',
  'win_match',
  'spend_balance',
]);
export type MissionType = z.infer<typeof MissionTypeSchema>;

export const MissionCadenceSchema = z.enum(['daily', 'weekly', 'monthly']);

export const MissionDtoSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  type: MissionTypeSchema,
  cadence: MissionCadenceSchema,
  tier: z.number().min(1),
  goal: z.number().min(1),
  progress: z.number().min(0),
  completed: z.boolean(),
  claimed: z.boolean(),
  expiresAt: z.iso.datetime(),
  reward: MissionRewardDtoSchema.nullable(),
});
export type MissionDto = z.infer<typeof MissionDtoSchema>;

export const MissionsResponseSchema = z.object({ missions: z.array(MissionDtoSchema) });
export type MissionsResponse = z.infer<typeof MissionsResponseSchema>;

/** Missions completed and rewarded by the action that produced the response. */
export const CompletedMissionDtoSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  cadence: MissionCadenceSchema,
  reward: z.object({
    itemId: z.uuid(),
    type: z.enum(['card', 'pack', 'balance', 'field']),
    quantity: z.number().min(1),
    resourceId: z.uuid().nullable(),
  }),
});
export type CompletedMissionDto = z.infer<typeof CompletedMissionDtoSchema>;

const AdminMissionRewardTypeSchema = z.enum(['card', 'pack', 'balance', 'field']);

export const AdminMissionRewardInputSchema = z.object({
  type: AdminMissionRewardTypeSchema,
  amount: z.number().int().min(1).max(1_000_000),
  resourceId: z.uuid().nullable(),
});

export const AdminMissionInputSchema = z.object({
  title: z.string().min(1).max(120),
  type: MissionTypeSchema,
  cadence: MissionCadenceSchema,
  /** Slot of the cycle: each player gets one random active mission per cadence and tier. */
  tier: z.number().int().min(1).max(10),
  goal: z.number().int().min(1).max(1_000_000),
  active: z.boolean(),
  /** Pool drawn from when the mission is assigned; one reward is picked at random. */
  rewards: z.array(AdminMissionRewardInputSchema).min(1).max(20),
});
export type AdminMissionInput = z.infer<typeof AdminMissionInputSchema>;

export const AdminMissionSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  type: MissionTypeSchema,
  cadence: MissionCadenceSchema,
  tier: z.number().int().min(1),
  goal: z.number().int().min(1),
  active: z.boolean(),
  assignments: z.number().int().min(0),
  /** Type, cadence, tier and goal are immutable once a player received the mission. */
  locked: z.boolean(),
  rewards: z.array(
    z.object({
      itemId: z.uuid(),
      type: AdminMissionRewardTypeSchema,
      amount: z.number().int().min(1),
      resourceId: z.uuid().nullable(),
      resourceName: z.string().nullable(),
    }),
  ),
});
export type AdminMission = z.infer<typeof AdminMissionSchema>;

const ResourceOptionSchema = z.object({ id: z.uuid(), name: z.string() });

export const AdminMissionOptionsSchema = z.object({
  cards: z.array(ResourceOptionSchema),
  packs: z.array(ResourceOptionSchema),
  fields: z.array(ResourceOptionSchema),
});
export type AdminMissionOptions = z.infer<typeof AdminMissionOptionsSchema>;
