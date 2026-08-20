import { describe, expect, it } from 'vitest';

import type { PackRepository } from '../../pack.types.js';
import { PurchasePackUseCase } from '../purchase-pack.use-case.js';

const identity = { id: 'discord-1', name: 'Jogador', avatarUrl: null };
const progression = { gainedXp: 10, level: 1, xp: 10, nextLevelXp: 100, rewards: [] };

describe('PurchasePackUseCase', () => {
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
});
