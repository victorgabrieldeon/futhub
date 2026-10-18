import { describe, expect, it } from 'vitest';

import { type CpuCandidate, buildCpuLineup, lineupRating } from '../league.cpu.js';
import { simulateMatch, validateLineup } from '../league.simulator.js';
import type { LineupCard } from '../league.types.js';

const positions = ['GOL', 'LD', 'LE', 'ZAG', 'ZAG', 'VOL', 'MC', 'MA', 'PD', 'PE', 'CA'];

const opponent: LineupCard[] = positions.map((assignedPosition, index) => ({
  userCardId: `owner-${index}`,
  name: `Owner ${index}`,
  assignedPosition,
  allowedPositions: [assignedPosition],
  attack: 80,
  creation: 80,
  defense: 80,
  finishing: 80,
  passing: 80,
  control: 80,
  marking: 80,
}));

function candidate(name: string, position: string, overall: number): CpuCandidate {
  return {
    name,
    position,
    overall,
    attack: overall,
    creation: overall,
    defense: overall,
    finishing: overall,
    passing: overall,
    control: overall,
    marking: overall,
  };
}

describe('cpu lineup', () => {
  it('mirrors positions with distinct cards of similar strength and is reproducible', () => {
    const pool = positions.flatMap((position, index) => [
      candidate(`${position} ${index} forte`, position, 81),
      candidate(`${position} ${index} fraco`, position, 60),
    ]);

    const first = buildCpuLineup(pool, opponent, 42);

    expect(first).toEqual(buildCpuLineup(pool, opponent, 42));
    expect(first.map((card) => card.assignedPosition)).toEqual(positions);
    expect(new Set(first.map((card) => card.name)).size).toBe(11);
    expect(new Set(first.map((card) => card.userCardId)).size).toBe(11);
    expect(lineupRating(first)).toBeGreaterThanOrEqual(70);
  });

  it('fills the lineup from any position and reuses cards when the catalog is small', () => {
    const lineup = buildCpuLineup([candidate('Único', 'CA', 75)], opponent, 7);

    expect(lineup).toHaveLength(11);
    expect(lineup.every((card) => card.name === 'Único')).toBe(true);
  });

  const catalogs = [
    {
      name: 'full catalog',
      pool: positions.map((position, i) => candidate(`Card ${i}`, position, 80 + i)),
    },
    { name: 'single card catalog', pool: [candidate('Only card', 'CA', 99)] },
  ];

  it.each(catalogs)('scales every effective attribute deterministically with $name', ({ pool }) => {
    const originalPool = structuredClone(pool);
    const originalOpponent = structuredClone(opponent);
    for (const seed of [1, 42, 2_147_483_647]) {
      const medium = buildCpuLineup(pool, opponent, seed);
      expect(buildCpuLineup(pool, opponent, seed, 'medium')).toEqual(medium);
      for (const [difficulty, multiplier] of [
        ['easy', 0.8],
        ['medium', 1],
        ['hard', 1.2],
      ] as const) {
        const lineup = buildCpuLineup(pool, opponent, seed, difficulty);
        expect(lineup).toEqual(buildCpuLineup(pool, opponent, seed, difficulty));
        validateLineup(lineup, positions);
        expect(lineup).toEqual(
          medium.map((card) => ({
            ...card,
            attack: card.attack * multiplier,
            creation: card.creation * multiplier,
            defense: card.defense * multiplier,
            finishing: card.finishing * multiplier,
            passing: card.passing * multiplier,
            control: card.control * multiplier,
            marking: card.marking * multiplier,
          })),
        );
      }
      expect(lineupRating(buildCpuLineup(pool, opponent, seed, 'easy'))).toBeLessThan(
        lineupRating(medium),
      );
      expect(lineupRating(buildCpuLineup(pool, opponent, seed, 'hard'))).toBeGreaterThan(
        lineupRating(medium),
      );
    }
    expect(pool).toEqual(originalPool);
    expect(opponent).toEqual(originalOpponent);
  });

  it.each(catalogs)('increases CPU results over 1000 fixed seeds with $name', ({ pool }) => {
    const results = (['easy', 'medium', 'hard'] as const).map((difficulty) => {
      let goalDifference = 0;
      let points = 0;
      for (let seed = 1; seed <= 1000; seed++) {
        const cpu = buildCpuLineup(pool, opponent, seed, difficulty);
        const match = simulateMatch(opponent, cpu, seed);
        expect(match).toEqual(simulateMatch(opponent, cpu, seed));
        expect(match.events.at(-1)).toMatchObject({
          type: 'fulltime',
          homeGoals: match.homeGoals,
          awayGoals: match.awayGoals,
        });
        goalDifference += match.awayGoals - match.homeGoals;
        points +=
          match.awayGoals > match.homeGoals ? 3 : match.awayGoals === match.homeGoals ? 1 : 0;
      }
      return { goalDifference, points };
    });
    expect(results[0]?.goalDifference).toBeLessThan(results[1]?.goalDifference ?? 0);
    expect(results[1]?.goalDifference).toBeLessThan(results[2]?.goalDifference ?? 0);
    expect(results[0]?.points).toBeLessThan(results[1]?.points ?? 0);
    expect(results[1]?.points).toBeLessThan(results[2]?.points ?? 0);
  });

  it('rejects an empty catalog', () => {
    expect(() => buildCpuLineup([], opponent, 1)).toThrow('CPU lineup requires catalog cards.');
  });
});
