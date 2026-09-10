export type LucroRewardMessages = Readonly<{ pt: string; es: string; en: string }>;

export type LucroReward = Readonly<{
  id: string;
  value: number;
  weight: number;
  messages: LucroRewardMessages;
}>;

export type LucroConfig = Readonly<{
  cooldownSeconds: number;
  rewards: readonly LucroReward[];
  embed: LucroConfigInputDto['embed'];
}>;
import type { LucroConfigInputDto } from '@futhub/api-client';
