import assert from 'node:assert/strict';
import test from 'node:test';

import { type CommandHandlers, CommandInputError, dispatchInteraction } from './discord.js';
import { formatCommandResult } from './lucro.js';
import { noMentions } from './responses.js';

function interaction(commandName = 'lucro', options: Record<string, string> = {}) {
  const replies: unknown[] = [];
  const value = {
    commandName,
    options: { getString: (name: string) => options[name] ?? null },
    user: { id: '1', username: 'Nome', avatarURL: () => 'avatar' },
    replied: false,
    deferred: false,
    deferReply: async () => {
      value.deferred = true;
    },
    editReply: async (reply: unknown) => {
      replies.push(reply);
    },
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
  assert.deepEqual(fake.replies, [{ content: 'resposta', allowedMentions: noMentions }]);
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
            embed: {
              title: '/lucro',
              description: '{message} {balance}',
              color: '#123456',
              footer: 'Próximo: {availableAt}',
            },
          },
          now,
        ),
    },
  };

  await dispatchInteraction(fake.value, handlers, new Date('2026-08-15T12:00:00.000Z'));

  assert.deepEqual(fake.replies, [
    {
      allowedMentions: noMentions,
      embeds: [
        {
          title: '/lucro',
          description: 'Lucro básico: +50 450',
          color: 1193046,
          footer: { text: 'Próximo: <t:1786795800:F>' },
        },
      ],
    },
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
    { content: 'Consulte a mensagem privada.', allowedMentions: noMentions },
    {
      content:
        'Nao foi possivel confirmar o resultado. Confira seu saldo e inventario antes de repetir.',
      flags: 64,
      allowedMentions: noMentions,
    },
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
  assert.deepEqual(fake.replies, [
    { content: 'Consulte a mensagem privada.', allowedMentions: noMentions },
    { content: 'Informe ids.', flags: 64, allowedMentions: noMentions },
  ]);
  assert.equal(errors.length, 0);
});
