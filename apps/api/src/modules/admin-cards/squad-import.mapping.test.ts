import { describe, expect, it } from 'vitest';

import {
  cardSlug,
  eaPosition,
  estimatedRatings,
  sportsDbPosition,
} from './squad-import.mapping.js';

describe('squad import mapping', () => {
  it('maps EA positions to catalog positions', () => {
    expect(['GK', 'RWB', 'LB', 'CB', 'CDM', 'CM', 'CAM', 'RW', 'LM', 'CF'].map(eaPosition)).toEqual(
      ['GOL', 'LD', 'LE', 'ZAG', 'VOL', 'MC', 'MA', 'PD', 'PE', 'CA'],
    );
    expect(eaPosition('SUB')).toBeNull();
  });

  it('maps TheSportsDB labels, checking specific roles before generic ones', () => {
    expect(
      [
        'Goalkeeper',
        'Right-Back',
        'Left Wing-Back',
        'Centre-Back',
        'Defender',
        'Defensive Midfield',
        'Attacking Midfield',
        'Left Winger',
        'Central Midfield',
        'Second Striker',
        'Forward',
        'Unknown',
      ].map(sportsDbPosition),
    ).toEqual(['GOL', 'LD', 'LE', 'ZAG', 'ZAG', 'VOL', 'MA', 'PE', 'MC', 'CA', 'CA', 'MC']);
  });

  it('keeps estimated attributes inside the catalog limits', () => {
    expect(estimatedRatings('GOL', 60)).toMatchObject({ overall: 60, finishing: 5, marking: 60 });
    expect(estimatedRatings('PD', 98)).toMatchObject({ pace: 99, marking: 58 });
  });

  it('builds unique catalog slugs within an import', () => {
    const taken = new Set<string>();
    expect(cardSlug(['Vinícius Júnior', 'real-madrid', 'ouro'], taken)).toBe(
      'vinicius-junior-real-madrid-ouro',
    );
    expect(cardSlug(['Vinícius Júnior', 'real-madrid', 'ouro'], taken)).toBe(
      'vinicius-junior-real-madrid-ouro-2',
    );
    expect(cardSlug(['x'.repeat(120)], taken)).toHaveLength(96);
  });
});
