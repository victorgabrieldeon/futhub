import { z } from 'zod';

export const LucroMessagesDtoSchema = z.object({
  pt: z.string().min(1).max(280),
  es: z.string().min(1).max(280),
  en: z.string().min(1).max(280),
});
export type LucroMessagesDto = z.infer<typeof LucroMessagesDtoSchema>;

export const LucroRewardInputDtoSchema = z.object({
  value: z.number().int().min(1),
  weight: z.number().int().min(1),
  messages: LucroMessagesDtoSchema,
});
export type LucroRewardInputDto = z.infer<typeof LucroRewardInputDtoSchema>;

export const LucroEmbedDtoSchema = z.object({
  title: z.string().min(1).max(256),
  description: z.string().min(1).max(4_000),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  footer: z.string().max(2_048),
});
export type LucroEmbedDto = z.infer<typeof LucroEmbedDtoSchema>;

export const LucroConfigInputDtoSchema = z.object({
  cooldownSeconds: z.number().int().min(1),
  rewards: z.array(LucroRewardInputDtoSchema).min(1),
  embed: LucroEmbedDtoSchema,
});
export type LucroConfigInputDto = z.infer<typeof LucroConfigInputDtoSchema>;

export const LucroRewardDtoSchema = LucroRewardInputDtoSchema.extend({ id: z.uuid() });
export type LucroRewardDto = z.infer<typeof LucroRewardDtoSchema>;

export const LucroConfigDtoSchema = z.object({
  cooldownSeconds: z.number(),
  rewards: z.array(LucroRewardDtoSchema),
  embed: LucroEmbedDtoSchema,
});
export type LucroConfigDto = z.infer<typeof LucroConfigDtoSchema>;

const embedPropertySchema = z.object({ maxLength: z.number(), examples: z.array(z.string()) });
export const LucroEmbedSchemaDtoSchema = z.object({
  description: z.string(),
  variables: z.array(z.object({ token: z.string(), description: z.string(), example: z.string() })),
  properties: z.object({
    title: embedPropertySchema,
    description: embedPropertySchema,
    color: embedPropertySchema,
    footer: embedPropertySchema,
  }),
});
export type LucroEmbedSchemaDto = z.infer<typeof LucroEmbedSchemaDtoSchema>;
