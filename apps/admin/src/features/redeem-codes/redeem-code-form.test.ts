import type { AdminRedeemCode } from '@futhub/api-client';
import { describe, expect, it } from 'vitest';
import {
  canonicalCode,
  draftFrom,
  emptyDraft,
  inputFrom,
  redeemCodeStatus,
  rewardLabel,
} from './redeem-code-form';

const code: AdminRedeemCode = {
  id: '00000000-0000-4000-8000-000000000001',
  code: 'BEMVINDO',
  active: true,
  maxClaims: 10,
  expiresAt: '2030-01-01T12:30:00.000Z',
  createdAt: '2026-10-10T12:00:00.000Z',
  claims: 3,
  locked: true,
  reward: {
    itemId: '00000000-0000-4000-8000-000000000002',
    type: 'pack',
    amount: 2,
    resourceId: '00000000-0000-4000-8000-000000000003',
    resourceName: 'Lendário',
  },
};

describe('redeem code form', () => {
  it('keeps only characters accepted by the API, in upper case', () => {
    expect(canonicalCode('bem vindo-2026!')).toBe('BEMVINDO-2026');
  });

  it('derives the status players experience', () => {
    const now = new Date('2026-10-10T12:00:00.000Z');
    expect(redeemCodeStatus(code, now)).toBe('active');
    expect(redeemCodeStatus({ ...code, active: false }, now)).toBe('inactive');
    expect(redeemCodeStatus({ ...code, expiresAt: now.toISOString() }, now)).toBe('expired');
    expect(redeemCodeStatus({ ...code, claims: 10 }, now)).toBe('exhausted');
    expect(redeemCodeStatus({ ...code, maxClaims: null, claims: 99 }, now)).toBe('active');
  });

  it('describes the granted Item', () => {
    expect(rewardLabel(code.reward)).toBe('2× pack Lendário');
    expect(rewardLabel({ ...code.reward, type: 'balance', amount: 1500, resourceId: null })).toBe(
      '1.500 moedas',
    );
    expect(rewardLabel({ ...code.reward, type: 'card', amount: 1, resourceName: null })).toBe(
      'carta recurso removido',
    );
  });

  it('round-trips an existing code through the draft', () => {
    const result = inputFrom(draftFrom(code));

    expect(result).toEqual({
      input: {
        code: 'BEMVINDO',
        reward: { type: 'pack', amount: 2, resourceId: code.reward.resourceId },
        maxClaims: 10,
        expiresAt: '2030-01-01T12:30:00.000Z',
        active: true,
      },
    });
  });

  it('sends unlimited codes without expiry and drops resources from balance rewards', () => {
    expect(
      inputFrom({ ...emptyDraft, code: 'MOEDAS', amount: '250', resourceId: 'stale' }),
    ).toEqual({
      input: {
        code: 'MOEDAS',
        reward: { type: 'balance', amount: 250, resourceId: null },
        maxClaims: null,
        expiresAt: null,
        active: true,
      },
    });
  });

  it('explains invalid drafts', () => {
    expect(inputFrom({ ...emptyDraft, code: 'AB' })).toHaveProperty('error');
    expect(inputFrom({ ...emptyDraft, code: 'OK1', amount: '0' })).toHaveProperty('error');
    expect(inputFrom({ ...emptyDraft, code: 'OK1', rewardType: 'card' })).toEqual({
      error: 'Escolha carta da recompensa.',
    });
    expect(
      inputFrom({ ...emptyDraft, code: 'OK1', rewardType: 'field', amount: '2', resourceId: 'x' }),
    ).toHaveProperty('error');
    expect(inputFrom({ ...emptyDraft, code: 'OK1', maxClaims: '0' })).toHaveProperty('error');
  });
});
