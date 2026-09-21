import { z } from 'zod';

export const ProgressionRewardDtoSchema = z.object({
  itemId: z.uuid(),
  type: z.enum(['card', 'pack', 'balance', 'field']),
  quantity: z.number().min(1),
  resourceId: z.uuid().nullable(),
});
export type ProgressionRewardDto = z.infer<typeof ProgressionRewardDtoSchema>;

export const ProgressionDtoSchema = z.object({
  gainedXp: z.number().min(0),
  level: z.number().min(1),
  xp: z.number().min(0),
  nextLevelXp: z.number().min(1),
  rewards: z.array(ProgressionRewardDtoSchema).readonly(),
});
export type ProgressionDto = z.infer<typeof ProgressionDtoSchema>;
