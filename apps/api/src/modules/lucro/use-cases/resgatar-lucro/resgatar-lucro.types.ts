import type { ProgressionSummary } from '../../../progression/progression.js';

export type Reward = Readonly<{ value: number; weight: number; message: string }>;
export const rewardLocales = ['pt', 'es', 'en'] as const;
export type RewardLocale = (typeof rewardLocales)[number];
export type RewardMessages = Readonly<Record<RewardLocale, string>>;
export type LocalizedReward = Readonly<{
  value: number;
  weight: number;
  messages: RewardMessages;
}>;

export function rewardLocaleFor(language: string): RewardLocale {
  const locale = language.toLowerCase().split('-', 1)[0];
  return locale === 'es' || locale === 'en' ? locale : 'pt';
}

export type CommandEmbed = Readonly<{
  title: string;
  description: string;
  color: string;
  footer: string;
}>;

export type CommandConfig = Readonly<{
  name: string;
  cooldownSeconds: number;
  rewards: readonly Reward[];
  embed: CommandEmbed;
}>;

export type DiscordIdentity = Readonly<{
  id: string;
  name: string;
  avatarUrl: string | null;
}>;

export type CommandResult =
  | Readonly<{
      kind: 'success';
      reward: Reward;
      balance: number;
      availableAt: Date;
      progression: ProgressionSummary;
      embed: CommandEmbed;
    }>
  | Readonly<{ kind: 'cooldown'; availableAt: Date }>;

export type CommandTransaction = Readonly<{
  getAvailableAt(): Promise<Date | null>;
  credit(value: number): Promise<number>;
  grantProgression(): Promise<ProgressionSummary>;
  advanceMission(): Promise<void>;
  setAvailableAt(availableAt: Date): Promise<void>;
}>;

export abstract class ResgatarLucroRepository {
  abstract run<T>(
    command: CommandConfig,
    identity: DiscordIdentity,
    now: Date,
    operation: (transaction: CommandTransaction, persistedCommand: CommandConfig) => Promise<T>,
  ): Promise<T>;
}

export abstract class Clock {
  abstract now(): Date;
}

export abstract class RandomSource {
  abstract next(): number;
}

export const lucroDefaultRewards: readonly LocalizedReward[] = [
  {
    value: 50,
    weight: 50,
    messages: { pt: 'Lucro básico: +50', es: 'Ganancia básica: +50', en: 'Basic profit: +50' },
  },
  {
    value: 100,
    weight: 30,
    messages: { pt: 'Bom lucro: +100', es: 'Buena ganancia: +100', en: 'Good profit: +100' },
  },
  {
    value: 250,
    weight: 15,
    messages: { pt: 'Grande lucro: +250', es: 'Gran ganancia: +250', en: 'Big profit: +250' },
  },
  {
    value: 500,
    weight: 4,
    messages: { pt: 'Lucro raro: +500', es: 'Ganancia rara: +500', en: 'Rare profit: +500' },
  },
  {
    value: 1000,
    weight: 1,
    messages: {
      pt: 'Lucro lendário: +1000',
      es: 'Ganancia legendaria: +1000',
      en: 'Legendary profit: +1000',
    },
  },
];

export const lucroCommand: CommandConfig = {
  name: 'lucro',
  cooldownSeconds: 600,
  rewards: lucroDefaultRewards.map(({ messages, ...reward }) => ({
    ...reward,
    message: messages.pt,
  })),
  embed: {
    title: 'Lucro resgatado',
    description:
      '{message}\n\n**+{reward} moedas**\nSaldo: **{balance}**\nXP: **+{xp}** · Nível: **{level}**\nPróximo lucro: {availableAt}',
    color: '#22c55e',
    footer: 'FutHub',
  },
};
