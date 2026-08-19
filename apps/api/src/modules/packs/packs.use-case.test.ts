import { describe, expect, it } from 'vitest';

import type { PackRepository } from './packs.types.js';
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
