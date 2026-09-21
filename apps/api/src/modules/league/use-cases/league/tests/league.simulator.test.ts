import { describe, expect, it } from 'vitest';

import { simulateMatch, validateLineup } from '../league.simulator.js';
import type { LineupCard } from '../league.types.js';

const positions = ['GOL', 'LD', 'LE', 'ZAG', 'ZAG', 'VOL', 'MC', 'MA', 'PD', 'PE', 'CA'];

function lineup(prefix: string, attack: number): LineupCard[] {
  return positions.map((assignedPosition, index) => ({
    userCardId: `${prefix}-${index}`,
    name: `${prefix} ${index}`,
    assignedPosition,
    allowedPositions: [assignedPosition],
    attack,
    creation: attack,
    defense: attack,
    finishing: attack,
    passing: attack,
    control: attack,
    marking: attack,
  }));
}

describe('league simulator', () => {
  it('generates reproducible events and a consistent score', () => {
    const home = lineup('home', 90);
    const away = lineup('away', 70);

    const first = simulateMatch(home, away, 1234);
    const second = simulateMatch(home, away, 1234);

    expect(first).toEqual(second);
    expect(first.events[0]).toMatchObject({ minute: 0, type: 'kickoff' });
    expect(first.events.at(-1)).toMatchObject({ minute: 90, type: 'fulltime' });
    expect(
      first.events.filter(
        (event) => event.type === 'goal' && event.playerUserCardId?.startsWith('home-'),
      ),
    ).toHaveLength(first.homeGoals);
    expect(
      first.events.filter(
        (event) => event.type === 'goal' && event.playerUserCardId?.startsWith('away-'),
      ),
    ).toHaveLength(first.awayGoals);

    const playerIds = new Set([...home, ...away].map((card) => card.userCardId));
    for (const event of first.events) {
      if (event.playerUserCardId) expect(playerIds).toContain(event.playerUserCardId);
      if (event.assistUserCardId) expect(playerIds).toContain(event.assistUserCardId);
    }
  });

  it('applies offensive and defensive tactical modifiers', () => {
    const home = lineup('home', 80);
    const away = lineup('away', 80);

    const attacking = simulateMatch(home, away, 2, 'offensive', 'defensive');
    const defending = simulateMatch(home, away, 2, 'defensive', 'offensive');

    expect([attacking.homeGoals, attacking.awayGoals]).toEqual([4, 2]);
    expect([defending.homeGoals, defending.awayGoals]).toEqual([1, 5]);
  });

  it('rejects incomplete and position-incompatible lineups', () => {
    const cards = lineup('home', 80);

    expect(() => validateLineup(cards.slice(1), positions)).toThrow(
      'Lineup must contain 11 holders.',
    );
    const firstCard = cards[0];
    if (!firstCard) throw new Error('Expected a lineup card.');
    expect(() =>
      validateLineup([{ ...firstCard, allowedPositions: ['CA'] }, ...cards.slice(1)], positions),
    ).toThrow('Holder position is incompatible with the card.');
  });
});
