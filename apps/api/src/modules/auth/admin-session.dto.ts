import { z } from 'zod';

export const AdminSessionInputSchema = z.object({
  apiKey: z.string().trim().min(1, 'Informe API key.'),
});
export type AdminSessionInput = z.infer<typeof AdminSessionInputSchema>;

export const AdminSessionResponseSchema = z.object({ ok: z.boolean() });
export type AdminSessionResponse = z.infer<typeof AdminSessionResponseSchema>;
