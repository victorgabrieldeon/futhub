import { describe, expect, it } from 'vitest';

import type {
  RedeemCode,
  ResgatarCodigoRepository,
  ResgatarCodigoTransaction,
} from '../resgatar-codigo.types.js';
import { ResgatarCodigoUseCase } from '../resgatar-codigo.use-case.js';

const now = new Date('2026-10-10T12:00:00.000Z');
const identity = { id: '123456789012345678', name: 'Jogador', avatarUrl: null };
const clock = { now: () => now };

function redeemCode(overrides: Partial<RedeemCode> = {}): RedeemCode {
  return {
    id: 'redeem-1',
    code: 'BEMVINDO',
    active: true,
    expiresAt: null,
    maxClaims: null,
    claims: 0,
    reward: {
      itemId: 'item-1',
      type: 'balance',
      quantity: 500,
      resourceId: null,
      resourceName: null,
    },
    ...overrides,
  };
}

function setup(
  code: RedeemCode | null,
  overrides: Partial<ResgatarCodigoTransaction> = {},
): { useCase: ResgatarCodigoUseCase; lookups: string[]; redeemed: RedeemCode[] } {
  const lookups: string[] = [];
  const redeemed: RedeemCode[] = [];
  const transaction: ResgatarCodigoTransaction = {
    findCode: async (value) => {
      lookups.push(value);
      return code;
    },
    hasRedeemed: async () => false,
    canReceive: async () => true,
    redeem: async (value) => {
      redeemed.push(value);
      return 1500;
    },
    ...overrides,
  };
  const repository: ResgatarCodigoRepository = {
    run: async (receivedIdentity, receivedNow, operation) => {
      expect(receivedIdentity).toBe(identity);
      expect(receivedNow).toBe(now);
      return operation(transaction);
    },
  };
  return { useCase: new ResgatarCodigoUseCase(repository, clock), lookups, redeemed };
}

describe('ResgatarCodigoUseCase', () => {
  it('normalizes the typed code and grants its Item', async () => {
    const code = redeemCode();
    const { useCase, lookups, redeemed } = setup(code);

    await expect(useCase.execute({ identity, code: '  bemVindo ' })).resolves.toEqual({
      kind: 'success',
      code: 'BEMVINDO',
      reward: code.reward,
      balance: 1500,
    });
    expect(lookups).toEqual(['BEMVINDO']);
    expect(redeemed).toEqual([code]);
  });

  it('rejects malformed codes without opening a transaction', async () => {
    const repository: ResgatarCodigoRepository = {
      run: () => {
        throw new Error('Repository must not be used.');
      },
    };

    await expect(
      new ResgatarCodigoUseCase(repository, clock).execute({ identity, code: 'a b' }),
    ).resolves.toEqual({ kind: 'rejected', reason: 'not_found' });
  });

  it.each([
    ['not_found', null, {}],
    ['inactive', redeemCode({ active: false }), {}],
    ['expired', redeemCode({ expiresAt: now }), {}],
    ['already_redeemed', redeemCode({ maxClaims: 1, claims: 1 }), { hasRedeemed: true }],
    ['exhausted', redeemCode({ maxClaims: 2, claims: 2 }), {}],
    ['inventory_full', redeemCode(), { canReceive: false }],
  ] as const)('rejects %s codes without granting', async (reason, code, flags) => {
    const { useCase, redeemed } = setup(code, {
      ...('hasRedeemed' in flags ? { hasRedeemed: async () => flags.hasRedeemed } : {}),
      ...('canReceive' in flags ? { canReceive: async () => flags.canReceive } : {}),
    });

    await expect(useCase.execute({ identity, code: 'BEMVINDO' })).resolves.toEqual({
      kind: 'rejected',
      reason,
    });
    expect(redeemed).toEqual([]);
  });

  it('accepts codes that expire later and still have claims left', async () => {
    const code = redeemCode({ expiresAt: new Date(now.getTime() + 1), maxClaims: 3, claims: 2 });
    const { useCase, redeemed } = setup(code);

    await expect(useCase.execute({ identity, code: 'BEMVINDO' })).resolves.toMatchObject({
      kind: 'success',
    });
    expect(redeemed).toEqual([code]);
  });
});
