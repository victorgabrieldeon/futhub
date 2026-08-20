import assert from 'node:assert/strict';
import test from 'node:test';

import { CommandInputError, type CommandHandlers, dispatchInteraction } from './discord.js';
import { formatCommandResult } from './lucro.js';

function interaction(commandName = 'lucro', options: Record<string, string> = {}) {
  const replies: unknown[] = [];
  const value = {
    commandName,
    options: { getString: (name: string) => options[name] ?? null },
    user: { id: '1', username: 'Nome', avatarURL: () => 'avatar' },
    replied: false,
    deferred: false,
    reply: async (reply: unknown) => {
      replies.push(reply);
    },
    followUp: async (reply: unknown) => {
      replies.push(reply);
    },
  };
  return { value, replies };
}

const definition = { name: 'lucro', description: 'Lucro', type: 1 };

test('dispatch encaminha identidade, opções e resposta', async () => {
  const fake = interaction('comprar-pack', { pack_id: 'pack-1' });
  const now = new Date('2026-08-15T12:00:00Z');
  let received: unknown;
  const handlers: CommandHandlers = {
    'comprar-pack': {
      definition,
      execute: async (identity, options) => {
        received = { identity, packId: options.getString('pack_id', true) };
        return 'resposta';
      },
    },
  };
  await dispatchInteraction(fake.value, handlers, now);
  assert.deepEqual(received, {
    identity: { id: '1', name: 'Nome', avatarUrl: 'avatar' },
    packId: 'pack-1',
  });
  assert.deepEqual(fake.replies, ['resposta']);
});

test('dispatch envia resposta formatada pelo comando', async () => {
  const fake = interaction();
  const handlers: CommandHandlers = {
    lucro: {
      definition,
      execute: async (_identity, _options, now) =>
        formatCommandResult(
          {
            kind: 'success',
            reward: { value: 50, weight: 50, message: 'Lucro básico: +50' },
            balance: 450,
            availableAt: '2026-08-15T12:10:00.000Z',
            progression: { gainedXp: 10, level: 1, xp: 10, nextLevelXp: 100, rewards: [] },
          },
          now,
        ),
    },
  };

  await dispatchInteraction(fake.value, handlers, new Date('2026-08-15T12:00:00.000Z'));

  assert.deepEqual(fake.replies, [
    'Lucro básico: +50 (+50). Saldo: 450. XP: +10 (10/100). Nível: 1. Próximo lucro: <t:1786795800:F>.',
  ]);
});

test('dispatch ignora comando desconhecido', async () => {
  const fake = interaction('outro');
  await dispatchInteraction(fake.value, {}, new Date());
  assert.deepEqual(fake.replies, []);
});

test('dispatch responde erro interno sem expor detalhe', async () => {
  const fake = interaction();
  const errors: unknown[] = [];
  await dispatchInteraction(
    fake.value,
    {
      lucro: {
        definition,
        execute: async () => {
          throw new Error('segredo interno');
        },
      },
    },
    new Date(),
    { error: (...values) => errors.push(values) },
  );
  assert.deepEqual(fake.replies, [
    { content: 'Não foi possível executar /lucro. Tente novamente.', ephemeral: true },
  ]);
  assert.equal(errors.length, 1);
});

test('dispatch retorna erro de entrada sem registrar falha interna', async () => {
  const fake = interaction();
  const errors: unknown[] = [];
  await dispatchInteraction(
    fake.value,
    {
      lucro: {
        definition,
        execute: async () => {
          throw new CommandInputError('Informe ids.');
        },
      },
    },
    new Date(),
    { error: (...values) => errors.push(values) },
  );
  assert.deepEqual(fake.replies, [{ content: 'Informe ids.', ephemeral: true }]);
  assert.equal(errors.length, 0);
});
