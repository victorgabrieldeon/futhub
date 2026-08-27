import type { ProgressionSummary } from '../../../progression/progression.js';

export type Reward = Readonly<{ value: number; weight: number; message: string }>;

export type LucroEmbed = Readonly<{
  title: string;
  description: string;
  color: string;
  footer: string;
}>;

export type CommandConfig = Readonly<{
  name: string;
  cooldownSeconds: number;
  rewards: readonly Reward[];
  embed?: LucroEmbed;
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
      embed: LucroEmbed;
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

export const lucroCommand: CommandConfig = {
  name: 'lucro',
  cooldownSeconds: 600,
  embed: {
    title: '/lucro',
    description:
      '**{message}**\nSaldo: **{balance}**\nXP: **+{xp}** ({xp}/{nextLevelXp})\nNível: **{level}**',
    color: '#2B2D31',
    footer: 'Próximo lucro: {availableAt}',
  },
  rewards: [
    {
      value: 50,
      weight: 50,
      message: 'Lucro básico: +50',
    },
    {
      value: 100,
      weight: 30,
      message: 'Bom lucro: +100',
    },
    {
      value: 250,
      weight: 15,
      message: 'Grande lucro: +250',
    },
    {
      value: 500,
      weight: 4,
      message: 'Lucro raro: +500',
    },
    {
      value: 1000,
      weight: 1,
      message: 'Lucro lendário: +1000',
    },
  ],
};
