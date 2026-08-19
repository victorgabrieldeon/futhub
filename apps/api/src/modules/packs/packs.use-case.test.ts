import { describe, expect, it } from 'vitest';

import type { PackRepository } from './packs.types.js';
import { selectPackCards } from './use-cases/open-pack/select-pack-cards.js';
import { OpenPackUseCase, PurchasePackUseCase } from './packs.use-case.js';

const identity = { id: 'discord-1', name: 'Jogador', avatarUrl: null };

describe('pack use cases', () => {
  it('delegates purchase with validated pack id', async () => {
    let received: string | undefined;
    const repository: PackRepository = {
      buy: async (_identity, packId) => {
        received = packId;
        return { balance: 70, quantity: 2 };
      },
      open: async () => [],
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
      buy: async () => ({ balance: 0, quantity: 0 }),
      open: async (_identity, _packId, random) => {
        received = random();
        return [{ id: 'owned-1', card: { id: 'card-1', overall: 80 } }];
      },
    };
    await expect(
      new OpenPackUseCase(repository, () => 0.5).execute(identity, 'pack-1'),
    ).resolves.toEqual([{ id: 'owned-1', card: { id: 'card-1', overall: 80 } }]);
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
