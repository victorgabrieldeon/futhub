export type Reward = Readonly<{ value: number; weight: number; message: string }>;

export type CommandConfig = Readonly<{
  name: string;
  cooldownSeconds: number;
  rewards: readonly Reward[];
}>;

export type DiscordIdentity = Readonly<{
  id: string;
  name: string;
  avatarUrl: string | null;
}>;

export type CommandResult =
  | Readonly<{ kind: 'success'; reward: Reward; balance: number; availableAt: Date }>
  | Readonly<{ kind: 'cooldown'; availableAt: Date }>;

export type CommandTransaction = Readonly<{
  getAvailableAt(): Promise<Date | null>;
  credit(value: number): Promise<number>;
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
  rewards: [
    { value: 50, weight: 50, message: 'Lucro básico: +50' },
    { value: 100, weight: 30, message: 'Bom lucro: +100' },
    { value: 250, weight: 15, message: 'Grande lucro: +250' },
    { value: 500, weight: 4, message: 'Lucro raro: +500' },
    { value: 1000, weight: 1, message: 'Lucro lendário: +1000' },
  ],
};
