import { describe, expect, it } from 'vitest';

import type { PackRepository } from './packs.types.js';
import { OpenPackUseCase, PurchasePackUseCase } from './packs.use-case.js';
import { selectPackCards } from './use-cases/open-pack/select-pack-cards.js';

const identity = { id: 'discord-1', name: 'Jogador', avatarUrl: null };
const progression = { gainedXp: 10, level: 1, xp: 10, nextLevelXp: 100, rewards: [] };

describe('pack use cases', () => {
  it('delegates purchase with validated pack id', async () => {
    let received: string | undefined;
    const repository: PackRepository = {
      runPurchase: async (_identity, packId, operation) => {
        received = packId;
        return operation({
          canBuy: true,
          balance: 100,
          ownedQuantity: 1,
          limitPerUser: 2,
          cardCount: 0,
          maxCards: 10,
          price: 30,
          commit: async () => ({ balance: 70, quantity: 2 }),
        });
      },
      runOpen: async (_identity, _packId, operation) =>
        operation({
          ownedQuantity: 1,
          cardCount: 0,
          maxCards: 10,
          cardsAmount: 1,
          candidates: [{ id: 'card-1', overall: 80 }],
          probabilities: [{ overall: 80, weight: 1 }],
          commit: async (cards) => cards.map((card) => ({ id: 'owned-1', card })),
          grantProgression: async () => progression,
        }),
    };
    await expect(new PurchasePackUseCase(repository).execute(identity, 'pack-1')).resolves.toEqual({
      balance: 70,
      quantity: 2,
    });
    expect(received).toBe('pack-1');
    expect(() => new PurchasePackUseCase(repository).execute(identity, '')).toThrow(
      'Pack id is required.',
    );
  });

  it('delegates opening with injected random source', async () => {
    let received = 0;
    const repository: PackRepository = {
      runPurchase: async (_identity, _packId, operation) =>
        operation({
          canBuy: true,
          balance: 100,
          ownedQuantity: 1,
          limitPerUser: 2,
          cardCount: 0,
          maxCards: 10,
          price: 30,
          commit: async () => ({ balance: 70, quantity: 2 }),
        }),
      runOpen: async (_identity, _packId, operation) => {
        received = 0.5;
        return operation({
          ownedQuantity: 1,
          cardCount: 0,
          maxCards: 10,
          cardsAmount: 1,
          candidates: [{ id: 'card-1', overall: 80 }],
          probabilities: [{ overall: 80, weight: 1 }],
          commit: async (cards) => cards.map((card) => ({ id: 'owned-1', card })),
          grantProgression: async () => progression,
        });
      },
    };
    await expect(
      new OpenPackUseCase(repository, () => 0.5).execute(identity, 'pack-1'),
    ).resolves.toEqual({
      cards: [{ id: 'owned-1', card: { id: 'card-1', overall: 80 } }],
      progression,
    });
    expect(received).toBe(0.5);
  });
});

describe('selectPackCards', () => {
  it('selects only eligible cards and permits duplicates', () => {
    const cards = [
      { id: 'low', overall: 70 },
      { id: 'high', overall: 80 },
    ];
    expect(selectPackCards(cards, [{ overall: 80, weight: 1 }], 2, () => 0)).toEqual([
      { id: 'high', overall: 80 },
      { id: 'high', overall: 80 },
    ]);
  });

  it('rejects a pack with no eligible weighted card', () => {
    expect(() =>
      selectPackCards([{ id: 'card', overall: 70 }], [{ overall: 80, weight: 1 }], 1, () => 0),
    ).toThrow('Pack has no eligible probabilities.');
  });
});
