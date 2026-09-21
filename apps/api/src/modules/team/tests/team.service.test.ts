import { describe, expect, it } from 'vitest';

import { selectAutomaticLineup } from '../team.service.js';

describe('automatic team lineup', () => {
  it('fills every compatible slot before maximizing strength', () => {
    const lineup = selectAutomaticLineup(
      [{ position: 'MA' }, { position: 'MC' }],
      [
        {
          userCardId: 'versatile',
          overall: 95,
          claimedAt: 2,
          positions: ['MA', 'MC'],
        },
        { userCardId: 'specialist', overall: 80, claimedAt: 1, positions: ['MA'] },
      ],
    );

    expect(lineup).toEqual([
      { userCardId: 'specialist', position: 'MA' },
      { userCardId: 'versatile', position: 'MC' },
    ]);
  });
});
