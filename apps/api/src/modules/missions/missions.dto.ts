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

export const MissionDtoSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  type: z.enum(['open_pack', 'sell_player', 'claim_profit', 'play_match']),
  cadence: z.enum(['daily', 'weekly', 'monthly']),
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
