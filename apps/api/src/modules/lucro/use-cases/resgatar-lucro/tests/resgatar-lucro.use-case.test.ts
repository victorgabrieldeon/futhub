import { describe, expect, it } from 'vitest';

import type {
  Clock,
  CommandConfig,
  CommandTransaction,
  RandomSource,
  ResgatarLucroRepository,
} from '../resgatar-lucro.types.js';
import { ResgatarLucroUseCase, selectWeightedReward } from '../resgatar-lucro.use-case.js';

const rewards = [
  { value: 50, weight: 1, message: 'Primeiro' },
  { value: 100, weight: 1, message: 'Segundo' },
];
const command: CommandConfig = { name: 'ganho', cooldownSeconds: 10, rewards };
const identity = { id: '1', name: 'Nome', avatarUrl: 'https://example.com/avatar.png' };

function memoryRepository(): ResgatarLucroRepository {
  let balance = 0;
  let availableAt: Date | null = null;
  return {
    run: async (_command, _identity, _now, operation) => {
      const transaction: CommandTransaction = {
        getAvailableAt: async () => availableAt,
        credit: async (value) => {
          balance += value;
          return balance;
        },
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
      balance: 50,
      availableAt: new Date('2026-08-15T12:00:10.000Z'),
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
      balance: 150,
      availableAt: new Date('2026-08-15T12:00:20.000Z'),
    });
  });
});
