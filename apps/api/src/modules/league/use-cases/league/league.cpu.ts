import { pick, seededRandom } from './league.simulator.js';
import type { LineupCard } from './league.types.js';

export type CpuCandidate = Readonly<{
  name: string;
  position: string;
  overall: number;
  attack: number;
  creation: number;
  defense: number;
  finishing: number;
  passing: number;
  control: number;
  marking: number;
}>;

const CLOSEST_CANDIDATES = 5;
const OVERALL_TOLERANCE = 3;

export function lineupRating(cards: readonly LineupCard[]): number {
  const total = cards.reduce((sum, card) => sum + card.attack + card.creation + card.defense, 0);
  return Math.round(total / (cards.length * 3));
}

/** Builds a reproducible CPU lineup mirroring the opponent's positions with catalog cards of similar strength. */
export function buildCpuLineup(
  pool: readonly CpuCandidate[],
  opponent: readonly LineupCard[],
  seed: number,
): LineupCard[] {
  if (pool.length === 0) throw new Error('CPU lineup requires catalog cards.');
  const random = seededRandom(seed ^ 0x5f3759df);
  const target = lineupRating(opponent);
  const used = new Set<CpuCandidate>();
  const distance = (candidate: CpuCandidate) => Math.abs(candidate.overall - target);

  return opponent.map((slot, index) => {
    const unused = pool.filter((candidate) => !used.has(candidate));
    const samePosition = unused.filter((candidate) => candidate.position === slot.assignedPosition);
    const candidates = samePosition.length > 0 ? samePosition : unused.length > 0 ? unused : pool;
    const sorted = [...candidates].sort((left, right) => distance(left) - distance(right));
    const best = sorted[0] ? distance(sorted[0]) : 0;
    const closest = sorted
      .filter((candidate) => distance(candidate) <= best + OVERALL_TOLERANCE)
      .slice(0, CLOSEST_CANDIDATES);
    const card = pick(closest, random);
    used.add(card);
    return {
      userCardId: `cpu-${String(index).padStart(2, '0')}`,
      name: card.name,
      assignedPosition: slot.assignedPosition,
      allowedPositions: [slot.assignedPosition],
      attack: card.attack,
      creation: card.creation,
      defense: card.defense,
      finishing: card.finishing,
      passing: card.passing,
      control: card.control,
      marking: card.marking,
    };
  });
}
