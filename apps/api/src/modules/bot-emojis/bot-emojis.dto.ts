import type { tags } from 'typia';

export type BotEmojiName = string & tags.Pattern<'^[A-Za-z0-9_]{2,32}$'>;

export interface BotEmojiDto {
  id: string;
  name: string;
  animated: boolean;
  imageUrl: string;
}

export interface BotEmojiListDto {
  /** Limite de emojis por aplicação imposto pelo Discord. */
  limit: number;
  emojis: BotEmojiDto[];
}

export interface CreateBotEmojiDto {
  name: BotEmojiName;
  /** Data URI PNG, JPEG, GIF ou WebP com até 256 KiB. */
  image: string & tags.MaxLength<360000>;
}

export interface RenameBotEmojiDto {
  name: BotEmojiName;
}
