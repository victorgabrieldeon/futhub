import type { AdminMission } from '@futhub/api-client';
import { describe, expect, it } from 'vitest';
import {
  draftFrom,
  emptyDraft,
  inputFrom,
  newRewardDraft,
  rewardLabel,
  slotsPerCadence,
  suggestedTitle,
} from './mission-form';

const mission: AdminMission = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Abra 3 packs',
  type: 'open_pack',
  cadence: 'weekly',
  tier: 2,
  goal: 3,
  active: true,
  assignments: 4,
  locked: true,
  rewards: [
    {
      itemId: '00000000-0000-4000-8000-000000000002',
      type: 'pack',
      amount: 2,
      resourceId: '00000000-0000-4000-8000-000000000003',
      resourceName: 'Lendário',
    },
    {
      itemId: '00000000-0000-4000-8000-000000000004',
      type: 'balance',
      amount: 1500,
      resourceId: null,
      resourceName: null,
    },
  ],
};

describe('mission form', () => {
  it('round-trips an existing mission into the API payload', () => {
    expect(inputFrom(draftFrom(mission))).toEqual({
      input: {
        title: 'Abra 3 packs',
        type: 'open_pack',
        cadence: 'weekly',
        tier: 2,
        goal: 3,
        active: true,
        rewards: [
          { type: 'pack', amount: 2, resourceId: '00000000-0000-4000-8000-000000000003' },
          { type: 'balance', amount: 1500, resourceId: null },
        ],
      },
    });
  });

  it('uses the suggested title when the admin leaves it empty', () => {
    const draft = { ...emptyDraft(), type: 'spend_balance' as const, goal: '5000' };
    expect(suggestedTitle(draft.type, draft.goal)).toBe('Gaste 5.000 moedas');
    expect(inputFrom(draft)).toMatchObject({ input: { title: 'Gaste 5.000 moedas', goal: 5000 } });
    expect(suggestedTitle('win_match', '1')).toBe('Vença uma partida');
  });

  it('rejects invalid goals, tiers and rewards', () => {
    expect(inputFrom({ ...emptyDraft(), goal: '0' })).toEqual({
      error: 'A meta deve ser um número inteiro maior que zero.',
    });
    expect(inputFrom({ ...emptyDraft(), tier: '11' })).toEqual({
      error: 'O tier deve ser um inteiro de 1 a 10.',
    });
    expect(inputFrom({ ...emptyDraft(), rewards: [] })).toEqual({
      error: 'Adicione ao menos uma recompensa.',
    });
    expect(inputFrom({ ...emptyDraft(), rewards: [newRewardDraft({ type: 'pack' })] })).toEqual({
      error: 'Escolha pack da recompensa.',
    });
    expect(inputFrom({ ...emptyDraft(), rewards: [newRewardDraft(), newRewardDraft()] })).toEqual({
      error: 'Há recompensas repetidas no sorteio.',
    });
  });

  it('labels rewards and counts the slots players receive per cycle', () => {
    expect(mission.rewards.map(rewardLabel)).toEqual(['2× pack Lendário', '1.500 moedas']);
    expect(
      slotsPerCadence([
        mission,
        { ...mission, id: 'b', tier: 1 },
        { ...mission, id: 'c', tier: 1 },
        { ...mission, id: 'd', tier: 3, active: false },
        { ...mission, id: 'e', cadence: 'daily', tier: 1, rewards: [] },
      ]),
    ).toEqual({ daily: 0, weekly: 2, monthly: 0 });
  });
});
