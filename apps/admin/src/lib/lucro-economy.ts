import type { LucroReward } from './lucro';

export type LucroEconomyInput = Readonly<{
  cooldownSeconds: number;
  rewards: ReadonlyArray<Readonly<Pick<LucroReward, 'value' | 'weight'>>>;
}>;

export type LucroDistributionReward = Readonly<{
  value: number;
  weight: number;
  chance: number;
}>;

export type LucroEconomy = Readonly<{
  cooldownSeconds: number | null;
  distribution: readonly LucroDistributionReward[];
  totalWeight: number;
  averageReward: number;
  highestReward: LucroDistributionReward | null;
  lowestReward: LucroDistributionReward | null;
}>;

const rewardTiers = [
  { name: 'Lucro básico', rarity: 'Comum' },
  { name: 'Bom lucro', rarity: 'Incomum' },
  { name: 'Grande lucro', rarity: 'Valioso' },
  { name: 'Lucro raro', rarity: 'Raro' },
] as const;

export function analyzeLucroEconomy(input: LucroEconomyInput): LucroEconomy {
  const rewards = input.rewards.filter(
    (reward) =>
      Number.isFinite(reward.value) &&
      reward.value > 0 &&
      Number.isFinite(reward.weight) &&
      reward.weight > 0,
  );
  const totalWeight = rewards.reduce((total, reward) => total + reward.weight, 0);
  const distribution = rewards.map((reward) => ({
    ...reward,
    chance: totalWeight === 0 ? 0 : (reward.weight / totalWeight) * 100,
  }));
  const averageReward =
    totalWeight === 0
      ? 0
      : rewards.reduce((total, reward) => total + reward.value * reward.weight, 0) / totalWeight;
  const highestReward = distribution.reduce<LucroDistributionReward | null>(
    (highest, reward) => (!highest || reward.value > highest.value ? reward : highest),
    null,
  );
  const lowestReward = distribution.reduce<LucroDistributionReward | null>(
    (lowest, reward) => (!lowest || reward.value < lowest.value ? reward : lowest),
    null,
  );

  return {
    cooldownSeconds:
      Number.isFinite(input.cooldownSeconds) && input.cooldownSeconds > 0
        ? input.cooldownSeconds
        : null,
    distribution,
    totalWeight,
    averageReward,
    highestReward,
    lowestReward,
  };
}

export function getLucroRewardTier(
  value: number,
  distribution: readonly LucroDistributionReward[],
) {
  const values = [...new Set(distribution.map((reward) => reward.value))].sort(
    (left, right) => left - right,
  );
  const valueIndex = values.indexOf(value);
  const tierIndex =
    values.length < 2 || valueIndex < 0
      ? 0
      : Math.ceil((valueIndex * (rewardTiers.length - 1)) / (values.length - 1));

  return { ...(rewardTiers[tierIndex] ?? rewardTiers[0]), index: tierIndex };
}

export function rollLucroReward(
  distribution: readonly LucroDistributionReward[],
  random = Math.random,
): LucroDistributionReward | null {
  const totalWeight = distribution.reduce((total, reward) => total + reward.weight, 0);
  if (totalWeight <= 0) return null;

  const value = random();
  const target = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1) * totalWeight;
  let accumulatedWeight = 0;
  for (const reward of distribution) {
    accumulatedWeight += reward.weight;
    if (target < accumulatedWeight) return reward;
  }
  return distribution.at(-1) ?? null;
}

export function hasHighEconomyImpact(economy: LucroEconomy): boolean {
  const highestReward = economy.highestReward;
  if (!highestReward || !economy.cooldownSeconds) return false;

  return (
    (economy.cooldownSeconds <= 60 && economy.averageReward >= 250) ||
    (highestReward.value >= 500 && highestReward.chance >= 50)
  );
}
