import assert from 'node:assert/strict';
import test from 'node:test';

import { createMockBot } from '@slipher/testing';
import { MessageFlags } from 'seyfert';

import ComprarPackCommand from '../../src/commands/comprar-pack.js';
import { parseNavId } from '../../src/core/nav.js';
import {
  type ApiRequest,
  messageButtons,
  messageText,
  mockApi,
  withTemplates,
} from '../support/api.js';

const catalog = [
  {
    id: 'pack-1',
    name: 'Pack Ouro',
    emoji: '📦',
    cardsAmount: 3,
    price: 100,
    limitPerUser: 5,
    imageUrl: null,
  },
];

function store(templates: Record<string, unknown> = {}) {
  return withTemplates({ quantity: 2, balance: 4500, completedMissions: [] }, templates);
}

function routes(templates?: Record<string, unknown>) {
  const fallback = store(templates);
  return (request: ApiRequest) => (request.path === '/v1/packs' ? catalog : fallback(request));
}

test('compra pack pelo nome escolhido e oferece abrir na hora', async () => {
  const api = mockApi(routes());

  await using bot = await createMockBot({ commands: [ComprarPackCommand] });

  const result = await bot.slash(ComprarPackCommand, { options: { pack: 'pack-1' } });
  const message = result.messages[0];

  assert.match(messageText(message), /## 📦 Pack Ouro é seu!\nVocê tem \*\*2\*\* no inventário/);
  assert.match(messageText(message), /🪙 \*\*−100\*\* {2}· {2}saldo 4\.500/);
  const open = messageButtons(message).find((button) => button.label === 'Abrir agora');
  assert.deepEqual(parseNavId(open?.customId ?? ''), {
    target: 'open',
    ownerId: '900000000000000005',
    arg: 'pack-1',
  });
  assert.deepEqual(
    api.requests.map(({ method, path }) => `${method} ${path}`),
    ['GET /v1/packs', 'POST /v1/packs/pack-1/purchase', 'GET /v1/bot-responses/pack.purchase'],
  );
});

test('usa a resposta editada no painel, com filtros de variáveis', async () => {
  mockApi(
    routes({
      'pack.purchase': {
        mode: 'legacy',
        content: 'Comprou {packName}! {quantity} no inventário · saldo {balance|number}',
        embeds: [],
        components: [],
      },
    }),
  );

  await using bot = await createMockBot({ commands: [ComprarPackCommand] });

  const result = await bot.slash(ComprarPackCommand, { options: { pack: 'pack-1' } });

  assert.equal(result.content, 'Comprou Pack Ouro! 2 no inventário · saldo 4.500');
});

test('pack fora da loja vira aviso sem tentar comprar', async () => {
  const api = mockApi(routes());

  await using bot = await createMockBot({ commands: [ComprarPackCommand] });

  const result = await bot.slash(ComprarPackCommand, { options: { pack: 'sumiu' } });

  assert.match(messageText(result.messages[0]), /Pack não encontrado na loja/);
  assert.equal(result.messages[0]?.flags, 32768 | MessageFlags.Ephemeral);
  assert.deepEqual(
    api.requests.map(({ path }) => path),
    ['/v1/packs'],
  );
});

test('falha da API vira aviso privado e amigável', async (context) => {
  const api = mockApi({ message: 'Falha interna.' }, 503);
  context.mock.method(console, 'error', () => undefined);

  await using bot = await createMockBot({ commands: [ComprarPackCommand] });

  const result = await bot.slash(ComprarPackCommand, { options: { pack: 'pack-1' } });

  assert.match(messageText(result.messages[0]), /Não foi possível concluir \/comprar-pack/);
  assert.match(messageText(result.messages[0]), /servidor do jogo não respondeu/);
  assert.doesNotMatch(messageText(result.messages[0]), /Falha interna/);
  assert.equal(result.messages[0]?.flags, 32768 | MessageFlags.Ephemeral);
  assert.equal(api.requests.length, 1);
});
