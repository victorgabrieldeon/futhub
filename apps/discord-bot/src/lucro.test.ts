import assert from 'node:assert/strict';
import test from 'node:test';

import type { CommandRepository, CommandTransaction } from './lucro.js';
import { executeCommand, formatCommandResult, selectWeightedReward } from './lucro.js';

const command = {
  name: 'ganho',
  cooldownSeconds: 10,
  rewards: [
    { value: 50, weight: 1, message: 'Primeiro' },
    { value: 100, weight: 1, message: 'Segundo' },
  ],
};
const identity = { id: '1', name: 'Nome', avatarUrl: 'avatar' };

function memoryRepository(): CommandRepository {
  let balance = 0;
  let availableAt: Date | null = null;
  let locked = Promise.resolve();
  return {
    run: async (_command, _identity, _now, operation) => {
      const previous = locked;
      let unlock: () => void = () => undefined;
      locked = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      await previous;
      const snapshot = { balance, availableAt };
      try {
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
        return await operation(transaction, command);
      } catch (error) {
        balance = snapshot.balance;
        availableAt = snapshot.availableAt;
        throw error;
      } finally {
        unlock();
      }
    },
  };
}

test('seleciona recompensa nos limites dos pesos', () => {
  assert.equal(selectWeightedReward(command.rewards, 0).value, 50);
  assert.equal(selectWeightedReward(command.rewards, 0.499).value, 50);
  assert.equal(selectWeightedReward(command.rewards, 0.5).value, 100);
  assert.equal(selectWeightedReward(command.rewards, 0.999).value, 100);
});

test('persiste saldo e cooldown e permite uso no limite inclusivo', async () => {
  const repository = memoryRepository();
  const now = new Date('2026-08-15T12:00:00Z');
  const first = await executeCommand(repository, command, identity, now, () => 0);
  assert.deepEqual(first, {
    kind: 'success',
    reward: command.rewards[0],
    balance: 50,
    availableAt: new Date('2026-08-15T12:00:10Z'),
  });
  assert.equal(
    (await executeCommand(repository, command, identity, new Date('2026-08-15T12:00:09Z'))).kind,
    'cooldown',
  );
  const boundary = await executeCommand(
    repository,
    command,
    identity,
    new Date('2026-08-15T12:00:10Z'),
    () => 0.5,
  );
  assert.equal(boundary.kind, 'success');
  if (boundary.kind === 'success') assert.equal(boundary.balance, 150);
});

test('serializa execuções concorrentes para conceder uma recompensa', async () => {
  const repository = memoryRepository();
  const now = new Date('2026-08-15T12:00:00Z');
  const results = await Promise.all([
    executeCommand(repository, command, identity, now, () => 0),
    executeCommand(repository, command, identity, now, () => 0),
  ]);
  assert.deepEqual(results.map(({ kind }) => kind).sort(), ['cooldown', 'success']);
});

test('rollback restaura crédito quando gravação do cooldown falha', async () => {
  let balance = 0;
  const repository: CommandRepository = {
    run: async (_command, _identity, _now, operation) => {
      const snapshot = balance;
      try {
        return await operation(
          {
            getAvailableAt: async () => null,
            credit: async (value) => {
              balance += value;
              return balance;
            },
            setAvailableAt: async () => {
              throw new Error('falha');
            },
          },
          command,
        );
      } catch (error) {
        balance = snapshot;
        throw error;
      }
    },
  };
  await assert.rejects(executeCommand(repository, command, identity, new Date(), () => 0));
  assert.equal(balance, 0);
});

test('formata sucesso e cooldown para Discord', () => {
  const availableAt = new Date('2026-08-15T12:00:10Z');
  assert.match(
    formatCommandResult(
      {
        kind: 'success',
        reward: { value: 50, weight: 1, message: 'Primeiro' },
        balance: 50,
        availableAt,
      },
      new Date('2026-08-15T12:00:00Z'),
    ),
    /Primeiro \(\+50\).*Saldo: 50/,
  );
  assert.match(
    formatCommandResult({ kind: 'cooldown', availableAt }, new Date('2026-08-15T12:00:01Z')),
    /Aguarde 9s/,
  );
});
