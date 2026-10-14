import { describe, expect, it } from 'vitest';

import { type CpuCandidate, buildCpuLineup, lineupRating } from '../league.cpu.js';
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
});
