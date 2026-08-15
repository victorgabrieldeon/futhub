import assert from 'node:assert/strict';
import test from 'node:test';

import { type CommandHandlers, dispatchInteraction } from './discord.js';

function interaction(commandName = 'lucro') {
  const replies: unknown[] = [];
  const value = {
    commandName,
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

test('dispatch encaminha identidade, horário e resposta', async () => {
  const fake = interaction();
  const now = new Date('2026-08-15T12:00:00Z');
  let received: unknown;
  const handlers: CommandHandlers = {
    lucro: {
      definition,
      execute: async (identity, receivedNow) => {
        received = { identity, now: receivedNow };
        return { kind: 'cooldown', availableAt: now };
      },
      format: () => 'resposta',
    },
  };
  await dispatchInteraction(fake.value, handlers, now);
  assert.deepEqual(received, {
    identity: { id: '1', name: 'Nome', avatarUrl: 'avatar' },
    now,
  });
  assert.deepEqual(fake.replies, ['resposta']);
});

test('dispatch ignora comando desconhecido', async () => {
  const fake = interaction('outro');
  await dispatchInteraction(fake.value, {}, new Date());
  assert.deepEqual(fake.replies, []);
});

test('dispatch responde erro efêmero sem expor detalhe', async () => {
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
        format: () => '',
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
