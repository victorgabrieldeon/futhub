import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatCardPurchase,
  formatCardsSale,
  formatPackOpen,
  formatPackPurchase,
  formatPackStore,
} from '../src/modules/store/format.js';

test('formata resultados de packs e mercado', () => {
  assert.equal(
    formatPackPurchase({ quantity: 2, balance: 450 }),
    'Pack comprado. Quantidade: 2. Saldo: 450.',
  );
  assert.equal(
    formatPackStore([
      {
        id: 'pack-1',
        name: 'Pack Ouro',
        emoji: '📦',
        cardsAmount: 3,
        price: 50,
        limitPerUser: 2,
      },
    ]),
    '## Loja\n### Packs\n📦 **Pack Ouro** — 3 carta(s), 50 moedas, limite 2.\nID: `pack-1`\n\nComprar: `/loja aba:packs pack_id:<ID>`.',
  );
  assert.equal(
    formatPackOpen({
      cards: [{ id: 'user-card-1', card: { id: 'card-1', overall: 91 } }],
      progression: { gainedXp: 10, xp: 10, nextLevelXp: 100, level: 1, rewards: [] },
    }),
    'Pack aberto.\n• `user-card-1` — OVR 91\nXP: +10 (10/100). Nível: 1.',
  );
  assert.equal(
    formatCardPurchase({ userCardId: 'user-card-1', price: 100, balance: 350 }),
    'Carta comprada. ID no elenco: `user-card-1`. Preço: 100. Saldo: 350.',
  );
  assert.equal(
    formatCardsSale({ userCardIds: ['user-card-1', 'user-card-2'], amount: 125, balance: 475 }),
    '2 carta(s) vendida(s). Recebido: 125. Saldo: 475.',
  );
});
