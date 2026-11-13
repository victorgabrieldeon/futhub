import { z } from 'zod';

export const AiProviderNameSchema = z.enum(['openai', 'opencode-go', 'anthropic']);

export const AiSessionInputSchema = z.object({
  provider: AiProviderNameSchema,
  baseUrl: z.string().min(1).max(2048),
  apiKey: z.string().min(1).max(4096).optional(),
});
export type AiSessionInput = z.infer<typeof AiSessionInputSchema>;

export const AiSavedConfigSchema = z.object({
  provider: AiProviderNameSchema,
  baseUrl: z.string(),
  apiKeyConfigured: z.boolean(),
  models: z.array(z.string()),
  model: z.string().nullable(),
});
export type AiSavedConfig = z.infer<typeof AiSavedConfigSchema>;

export const AiPromptInputSchema = z.object({
  model: z.string().min(1).max(200),
  message: z.string().min(1).max(12000),
});
export type AiPromptInput = z.infer<typeof AiPromptInputSchema>;

export const AiApprovalInputSchema = z.object({ approved: z.boolean() });
export type AiApprovalInput = z.infer<typeof AiApprovalInputSchema>;

export const AiMutationNameSchema = z.enum([
  'create_team',
  'create_collection',
  'create_card',
  'create_pack',
]);
export type AiMutationName = z.infer<typeof AiMutationNameSchema>;

export const AiChatActionSchema = z.object({
  id: z.string(),
  tool: AiMutationNameSchema,
  arguments: z.string(),
  status: z.enum(['pending', 'succeeded', 'failed', 'rejected']),
  result: z.string().nullable(),
});
export type AiChatAction = z.infer<typeof AiChatActionSchema>;

export const AiChatStateSchema = z.object({
  id: z.string(),
  models: z.array(z.string()),
  model: z.string().nullable(),
  notice: z.string().nullable(),
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant', 'tool']),
      content: z.string(),
    }),
  ),
  actions: z.array(AiChatActionSchema),
});
export type AiChatState = z.infer<typeof AiChatStateSchema>;

export const AiCapabilitiesSchema = z.object({ webSearch: z.boolean() });
export type AiCapabilities = z.infer<typeof AiCapabilitiesSchema>;

export const AiHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).optional(),
});
export type AiHistoryQuery = z.infer<typeof AiHistoryQuerySchema>;

export const AiHistorySummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  provider: AiProviderNameSchema,
  model: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AiHistorySummary = z.infer<typeof AiHistorySummarySchema>;

export const AiHistoryPageSchema = z.object({
  items: z.array(AiHistorySummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type AiHistoryPage = z.infer<typeof AiHistoryPageSchema>;

export const AiHistoryDetailSchema = AiHistorySummarySchema.extend({ state: AiChatStateSchema });
export type AiHistoryDetail = z.infer<typeof AiHistoryDetailSchema>;

export type AiStreamEvent =
  | { type: 'done' }
  | { type: 'text'; messageId: string; delta: string }
  | { type: 'state'; state: AiChatState }
  | { type: 'error'; message: string };
export type AiStreamSink = (event: AiStreamEvent) => void;
