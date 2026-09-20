import type {
  LineupCard,
  SimulatedMatch,
  SimulatedMatchEvent,
  TeamTactic,
} from './league.types.js';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick<T>(values: readonly T[], random: () => number): T {
  const value = values[Math.floor(random() * values.length)];
  if (value === undefined) throw new Error('Cannot select a player from an empty lineup.');
  return value;
}

function sum(cards: readonly LineupCard[], field: 'attack' | 'creation' | 'defense'): number {
  return cards.reduce((total, card) => total + card[field], 0);
}

function orderedMinutes(random: () => number, count: number): number[] {
  const minutes = new Set<number>();
  while (minutes.size < count) minutes.add(1 + Math.floor(random() * 89));
  return [...minutes].sort((left, right) => left - right);
}

export function validateLineup(
  cards: readonly LineupCard[],
  formationPositions: readonly string[],
): void {
  if (cards.length !== 11 || formationPositions.length !== 11)
    throw new Error('Lineup must contain 11 holders.');
  if (new Set(cards.map((card) => card.userCardId)).size !== cards.length)
    throw new Error('Lineup contains a duplicated holder.');

  const expected = new Map<string, number>();
  for (const position of formationPositions)
    expected.set(position, (expected.get(position) ?? 0) + 1);
  const assigned = new Map<string, number>();
  for (const card of cards) {
    if (!card.allowedPositions.includes(card.assignedPosition))
      throw new Error('Holder position is incompatible with the card.');
    assigned.set(card.assignedPosition, (assigned.get(card.assignedPosition) ?? 0) + 1);
  }
  for (const [position, quantity] of expected) {
    if (assigned.get(position) !== quantity)
      throw new Error('Lineup does not match the selected formation.');
  }
}

export function simulateMatch(
  home: readonly LineupCard[],
  away: readonly LineupCard[],
  seed: number,
  homeTactic: TeamTactic = 'balanced',
  awayTactic: TeamTactic = 'balanced',
): SimulatedMatch {
  if (!Number.isSafeInteger(seed) || seed <= 0)
    throw new Error('Match seed must be a positive integer.');
  if (home.length !== 11 || away.length !== 11)
    throw new Error('Both lineups must contain 11 holders.');

  const random = seededRandom(seed);
  const homeCards = [...home].sort((left, right) =>
    left.userCardId.localeCompare(right.userCardId),
  );
  const awayCards = [...away].sort((left, right) =>
    left.userCardId.localeCompare(right.userCardId),
  );
  const modifier = {
    defensive: { attack: 0.9, defense: 1.1 },
    balanced: { attack: 1, defense: 1 },
    offensive: { attack: 1.1, defense: 0.9 },
  } as const;
  const homeAttack =
    (sum(homeCards, 'attack') + sum(homeCards, 'creation')) * modifier[homeTactic].attack;
  const awayAttack =
    (sum(awayCards, 'attack') + sum(awayCards, 'creation')) * modifier[awayTactic].attack;
  const homeDefense = sum(homeCards, 'defense') * modifier[homeTactic].defense;
  const awayDefense = sum(awayCards, 'defense') * modifier[awayTactic].defense;
  const events: SimulatedMatchEvent[] = [
    {
      minute: 0,
      type: 'kickoff',
      playerUserCardId: null,
      assistUserCardId: null,
      description: 'A partida começou.',
      homeGoals: 0,
      awayGoals: 0,
    },
  ];
  let homeGoals = 0;
  let awayGoals = 0;

  for (const minute of orderedMinutes(random, 8 + Math.floor(random() * 8))) {
    const homeOwnsAttack = random() < homeAttack / (homeAttack + awayAttack);
    const attackers = homeOwnsAttack ? homeCards : awayCards;
    const defenders = homeOwnsAttack ? awayCards : homeCards;
    const attackPower = homeOwnsAttack ? homeAttack : awayAttack;
    const defensePower = homeOwnsAttack ? awayDefense : homeDefense;
    const goalProbability = (attackPower / (attackPower + defensePower)) * 0.6;

    if (random() < goalProbability) {
      const scorer = pick(attackers, random);
      const assistants = attackers.filter((card) => card.userCardId !== scorer.userCardId);
      const assistant = pick(assistants, random);
      if (homeOwnsAttack) homeGoals += 1;
      else awayGoals += 1;
      events.push({
        minute,
        type: 'goal',
        playerUserCardId: scorer.userCardId,
        assistUserCardId: assistant.userCardId,
        description: `Gol de ${scorer.name}, com assistência de ${assistant.name}.`,
        homeGoals,
        awayGoals,
      });
      continue;
    }

    const card = pick(defenders, random);
    const type = random() < 0.12 ? 'yellow_card' : random() < 0.02 ? 'red_card' : null;
    if (type)
      events.push({
        minute,
        type,
        playerUserCardId: card.userCardId,
        assistUserCardId: null,
        description: `${type === 'yellow_card' ? 'Cartão amarelo' : 'Cartão vermelho'} para ${card.name}.`,
        homeGoals,
        awayGoals,
      });
  }

  events.push({
    minute: 90,
    type: 'fulltime',
    playerUserCardId: null,
    assistUserCardId: null,
    description: 'Fim de partida.',
    homeGoals,
    awayGoals,
  });
  return { homeGoals, awayGoals, events };
}
