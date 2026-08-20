import type { PackCard } from '../pack.types.js';

type Probability = Readonly<{ overall: number; weight: number }>;

function selectWeighted(probabilities: readonly Probability[], random: number): Probability {
  if (!Number.isFinite(random) || random < 0 || random >= 1)
    throw new Error('Random value must be in [0, 1).');
  const total = probabilities.reduce((sum, probability) => sum + probability.weight, 0);
  if (total <= 0) throw new Error('Pack has no eligible probabilities.');
  let point = random * total;
  for (const probability of probabilities) {
    point -= probability.weight;
    if (point < 0) return probability;
  }
  throw new Error('Unable to select pack probability.');
}

export function selectPackCards(
  cards: readonly PackCard[],
  probabilities: readonly Probability[],
  count: number,
  random: () => number,
): readonly PackCard[] {
  const available = probabilities.filter((probability) =>
    cards.some((card) => card.overall === probability.overall),
  );
  return Array.from({ length: count }, () => {
    const probability = selectWeighted(available, random());
    const matching = cards.filter((card) => card.overall === probability.overall);
    const card = matching[Math.floor(random() * matching.length)];
    if (!card) throw new Error('Unable to select an eligible card.');
    return card;
  });
}
