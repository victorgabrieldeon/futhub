import { describe, expect, it } from 'vitest';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  isCreateCardBaseBody,
  isSavedBase,
} from './card-bases.js';

const validBody = {
  design: {
    accentColor: '#c2f600',
    backgroundColor: '#0b1510',
    label: 'RARE GOLD',
    playerName: 'FUTURA ESTRELA',
    rating: '89',
  },
  height: CARD_HEIGHT,
  name: 'Rare Gold 2026',
  slug: 'rare-gold-2026',
  width: CARD_WIDTH,
};

describe('card base contract', () => {
  it('accepts valid request and saved base', () => {
    expect(isCreateCardBaseBody(validBody)).toBe(true);
    expect(
      isSavedBase({ id: 'base-1', name: validBody.name, slug: validBody.slug, updatedAt: 'now' }),
    ).toBe(true);
  });

  it.each([
    { ...validBody, width: '601' },
    { ...validBody, design: { ...validBody.design, accentColor: 'red' } },
    { ...validBody, design: { ...validBody.design, label: ' ' } },
    { ...validBody, design: { ...validBody.design, playerName: '' } },
    { ...validBody, design: { ...validBody.design, rating: '0' } },
    { ...validBody, design: { ...validBody.design, rating: '100' } },
  ])('rejects invalid request %#', (body) => {
    expect(isCreateCardBaseBody(body)).toBe(false);
  });

  it('rejects malformed saved base', () => {
    expect(isSavedBase({ id: 'base-1', name: 'Base' })).toBe(false);
  });
});
