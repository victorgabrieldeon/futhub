export type Reward = Readonly<{ value: number; weight: number; message: string }>;

export type CommandConfig = Readonly<{
  name: string;
  cooldownSeconds: number;
  rewards: readonly Reward[];
}>;

export type DiscordIdentity = Readonly<{ id: string; name: string; avatarUrl: string | null }>;

export type CommandResult =
  | Readonly<{ kind: 'success'; reward: Reward; balance: number; availableAt: Date }>
  | Readonly<{ kind: 'cooldown'; availableAt: Date }>;

export type CommandTransaction = Readonly<{
  getAvailableAt(): Promise<Date | null>;
  credit(value: number): Promise<number>;
  setAvailableAt(availableAt: Date): Promise<void>;
}>;

export type CommandRepository = Readonly<{
  run<T>(
    command: CommandConfig,
    identity: DiscordIdentity,
    now: Date,
    operation: (transaction: CommandTransaction, persistedCommand: CommandConfig) => Promise<T>,
  ): Promise<T>;
}>;

export function selectWeightedReward(rewards: readonly Reward[], random: number): Reward {
  if (rewards.length === 0) throw new Error('Command has no rewards.');
  if (!Number.isFinite(random) || random < 0 || random >= 1)
    throw new Error('Random value must be in [0, 1).');
  const total = rewards.reduce((sum, reward) => {
    if (!Number.isInteger(reward.weight) || reward.weight <= 0)
      throw new Error('Reward weight must be positive.');
    return sum + reward.weight;
  }, 0);
  let point = random * total;
  for (const reward of rewards) {
    point -= reward.weight;
    if (point < 0) return reward;
  }
  throw new Error('Unable to select reward.');
}

export async function executeCommand(
  repository: CommandRepository,
  command: CommandConfig,
  identity: DiscordIdentity,
  now: Date,
  random: () => number = Math.random,
): Promise<CommandResult> {
  return repository.run(command, identity, now, async (transaction, persistedCommand) => {
    const availableAt = await transaction.getAvailableAt();
    if (availableAt && now < availableAt) return { kind: 'cooldown', availableAt };

    const reward = selectWeightedReward(persistedCommand.rewards, random());
    const balance = await transaction.credit(reward.value);
    const nextAvailableAt = new Date(now.getTime() + persistedCommand.cooldownSeconds * 1000);
    await transaction.setAvailableAt(nextAvailableAt);
    return { kind: 'success', reward, balance, availableAt: nextAvailableAt };
  });
}

export function formatCommandResult(result: CommandResult, now: Date): string {
  const available = `<t:${Math.floor(result.availableAt.getTime() / 1000)}:F>`;
  if (result.kind === 'cooldown') {
    const remaining = Math.max(0, Math.ceil((result.availableAt.getTime() - now.getTime()) / 1000));
    return `Aguarde ${remaining}s. Lucro disponível em ${available}.`;
  }
  return `${result.reward.message} (+${result.reward.value}). Saldo: ${result.balance}. Próximo lucro: ${available}.`;
}
