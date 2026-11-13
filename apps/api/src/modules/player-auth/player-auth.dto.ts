import { z } from 'zod';

export const ActivityConfigSchema = z.object({
  clientId: z.string(),
  storageHost: z.string().nullable(),
});
export type ActivityConfig = z.infer<typeof ActivityConfigSchema>;

export const ActivityCodeRequestSchema = z.object({
  code: z.string().min(1).max(512).describe('Código do `authorize` do Embedded App SDK.'),
});
export type ActivityCodeRequest = z.infer<typeof ActivityCodeRequestSchema>;

export const PlayerSessionResponseSchema = z.object({
  avatarUrl: z.string().nullable(),
  balance: z.number(),
  expiresAt: z.number(),
  id: z.string(),
  name: z.string(),
  token: z.string().describe('Sessão assinada; o cliente envia como Bearer nas rotas de jogo.'),
});
export type PlayerSessionResponse = z.infer<typeof PlayerSessionResponseSchema>;

export const ActivitySessionResponseSchema = PlayerSessionResponseSchema.extend({
  accessToken: z.string().describe('Token OAuth do Discord para `authenticate` no SDK.'),
});
export type ActivitySessionResponse = z.infer<typeof ActivitySessionResponseSchema>;
