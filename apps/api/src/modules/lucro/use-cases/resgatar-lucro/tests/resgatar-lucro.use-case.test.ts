import { describe, expect, it } from 'vitest';

import type {
  Clock,
  CommandConfig,
  CommandTransaction,
  RandomSource,
  ResgatarLucroRepository,
} from '../resgatar-lucro.types.js';
import { lucroCommand } from '../resgatar-lucro.types.js';
import { ResgatarLucroUseCase, selectWeightedReward } from '../resgatar-lucro.use-case.js';

const rewards = [
  { value: 50, weight: 1, message: 'Primeiro' },
  { value: 100, weight: 1, message: 'Segundo' },
];
const command: CommandConfig = { name: 'ganho', cooldownSeconds: 10, rewards };
const identity = { id: '1', name: 'Nome', avatarUrl: 'https://example.com/avatar.png' };
const progression = { gainedXp: 10, level: 1, xp: 10, nextLevelXp: 100, rewards: [] };
const club = {
  balance: 0,
  stadium: {
    level: 1,
    maxLevel: 5,
    nextUpgradeCost: 1000,
    ticketRevenue: 200,
    maintenance: 50,
  },
  sponsor: {
    name: 'Comércio Local',
    weeklyMatches: 0,
    weeklyGoal: 3,
    payout: 300,
    completed: false,
  },
  payroll: 0,
  projectedNet: 150,
};

function memoryRepository(): ResgatarLucroRepository {
  let balance = 0;
  let availableAt: Date | null = null;
  return {
    run: async (_command, _identity, _now, operation) => {
      const transaction: CommandTransaction = {
        getAvailableAt: async () => availableAt,
        getClub: async () => club,
        credit: async (value) => {
          balance += value;
          return balance;
        },
        grantProgression: async () => progression,
        advanceMission: async () => undefined,
        setAvailableAt: async (value) => {
          availableAt = value;
        },
      };
      return operation(transaction, command);
    },
  };
}

function useCase(repository: ResgatarLucroRepository): ResgatarLucroUseCase {
  const clock: Clock = { now: () => new Date() };
  const random: RandomSource = { next: () => 0 };
  return new ResgatarLucroUseCase(repository, clock, random);
}

describe('selectWeightedReward', () => {
  it('selects rewards at weight boundaries', () => {
    expect(selectWeightedReward(rewards, 0)).toEqual(rewards[0]);
    expect(selectWeightedReward(rewards, 0.499)).toEqual(rewards[0]);
    expect(selectWeightedReward(rewards, 0.5)).toEqual(rewards[1]);
    expect(selectWeightedReward(rewards, 0.999)).toEqual(rewards[1]);
  });

  it('rejects invalid weights and random values', () => {
    expect(() => selectWeightedReward([], 0)).toThrow('Command has no rewards.');
    expect(() => selectWeightedReward([{ value: 50, weight: 0, message: 'Inválida' }], 0)).toThrow(
      'Reward weight must be positive.',
    );
    expect(() => selectWeightedReward(rewards, -0.1)).toThrow('Random value must be in [0, 1).');
    expect(() => selectWeightedReward(rewards, 1)).toThrow('Random value must be in [0, 1).');
  });
});

describe('ResgatarLucroUseCase.execute', () => {
  it('credits selected reward and starts cooldown', async () => {
    const result = await useCase(memoryRepository()).execute(
      identity,
      command,
      new Date('2026-08-15T12:00:00.000Z'),
      0,
    );

    expect(result).toEqual({
      kind: 'success',
      reward: { value: 50, weight: 1, message: 'Primeiro' },
      report: {
        ticketRevenue: 200,
        commercialRevenue: 50,
        sponsorRevenue: 0,
        maintenance: 50,
        payroll: 0,
        net: 200,
      },
      balance: 200,
      availableAt: new Date('2026-08-15T12:00:10.000Z'),
      progression,
      embed: lucroCommand.embed,
    });
  });

  it('returns cooldown without another credit before availableAt', async () => {
    const repository = memoryRepository();
    const subject = useCase(repository);
    await subject.execute(identity, command, new Date('2026-08-15T12:00:00.000Z'), 0);

    const result = await subject.execute(
      identity,
      command,
      new Date('2026-08-15T12:00:09.000Z'),
      0.5,
    );

    expect(result).toEqual({
      kind: 'cooldown',
      availableAt: new Date('2026-08-15T12:00:10.000Z'),
    });
  });

  it('allows another reward exactly at availableAt', async () => {
    const repository = memoryRepository();
    const subject = useCase(repository);
    await subject.execute(identity, command, new Date('2026-08-15T12:00:00.000Z'), 0);

    const result = await subject.execute(
      identity,
      command,
      new Date('2026-08-15T12:00:10.000Z'),
      0.5,
    );

    expect(result).toEqual({
      kind: 'success',
      reward: { value: 100, weight: 1, message: 'Segundo' },
      report: {
        ticketRevenue: 200,
        commercialRevenue: 100,
        sponsorRevenue: 0,
        maintenance: 50,
        payroll: 0,
        net: 250,
      },
      balance: 450,
      availableAt: new Date('2026-08-15T12:00:20.000Z'),
      progression,
      embed: lucroCommand.embed,
    });
  });
});
