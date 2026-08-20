import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatCardPurchase,
  formatCardsSale,
  formatLeagueStatus,
  formatMatch,
  formatPackOpen,
  formatPackPurchase,
  formatQueueStatus,
  formatRankedQueue,
} from './game.js';

test('formata resultados de packs e mercado', () => {
  assert.equal(
    formatPackPurchase({ quantity: 2, balance: 450 }),
    'Pack comprado. Quantidade: 2. Saldo: 450.',
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

test('formata resultados de liga e partida', () => {
  const division = {
    id: 'division-1',
    emoji: '🏆',
    name: 'Ouro',
    minimumPoints: 100,
    color: null,
    imageUrl: null,
  };
  assert.equal(
    formatRankedQueue({ kind: 'waiting', division }),
    'Você entrou na fila de 🏆 Ouro (100 pontos mínimos). Aguarde um adversário.',
  );
  assert.equal(
    formatRankedQueue({ kind: 'matched', matchId: 'match-1' }),
    'Adversário encontrado. Partida: `match-1`.',
  );
  assert.equal(
    formatLeagueStatus({ points: 120, wins: 4, draws: 1, losses: 2, division, queue: null }),
    '🏆 Ouro (100 pontos mínimos)\nPontos: 120. Vitórias: 4. Empates: 1. Derrotas: 2.\nFila: sem partida pendente.',
  );
  assert.equal(formatQueueStatus(null), 'Fila: sem partida pendente.');
  assert.equal(
    formatMatch({
      id: 'match-1',
      homeUserId: 'home-1',
      awayUserId: 'away-1',
      homeGoals: 2,
      awayGoals: 1,
      completedAt: '2026-08-15T12:00:00.000Z',
      events: [
        {
          sequence: 1,
          minute: 90,
          type: 'fulltime',
          playerUserCardId: null,
          assistUserCardId: null,
          description: 'Fim de jogo',
          homeGoals: 2,
          awayGoals: 1,
        },
      ],
    }),
    "Partida `match-1`: 2 × 1. Finalizada <t:1786795200:F>.\n90' — Fim de jogo",
  );
});
