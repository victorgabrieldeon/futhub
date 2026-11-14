import { z } from 'zod';

export const BotEmojiNameSchema = z.string().regex(/^[A-Za-z0-9_]{2,32}$/);
export type BotEmojiName = z.infer<typeof BotEmojiNameSchema>;

export const BotEmojiDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    animated: z.boolean(),
    imageUrl: z.string(),
  })
  .meta({ id: 'BotEmojiDto' });
export type BotEmojiDto = z.infer<typeof BotEmojiDtoSchema>;

export const BotEmojiListDtoSchema = z
  .object({
    limit: z.number().describe('Limite de emojis por aplicação imposto pelo Discord.'),
    emojis: z.array(BotEmojiDtoSchema),
  })
  .meta({ id: 'BotEmojiListDto' });
export type BotEmojiListDto = z.infer<typeof BotEmojiListDtoSchema>;

export const CreateBotEmojiDtoSchema = z
  .object({
    name: BotEmojiNameSchema,
    image: z.string().max(360000).describe('Data URI PNG, JPEG, GIF ou WebP com até 256 KiB.'),
  })
  .meta({ id: 'CreateBotEmojiDto' });
export type CreateBotEmojiDto = z.infer<typeof CreateBotEmojiDtoSchema>;

export const RenameBotEmojiDtoSchema = z
  .object({ name: BotEmojiNameSchema })
  .meta({ id: 'RenameBotEmojiDto' });
export type RenameBotEmojiDto = z.infer<typeof RenameBotEmojiDtoSchema>;
