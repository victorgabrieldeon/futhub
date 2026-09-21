import { z } from 'zod';

export const HealthResponseSchema = z.object({ status: z.enum(['ok']) });
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
