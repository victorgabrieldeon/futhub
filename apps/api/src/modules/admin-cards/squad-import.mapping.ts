import type { CardPosition, SquadImportPreviewPlayer } from './admin-cards.dto.js';

export const estimatedBaseOverall = 72;

type Ratings = Omit<
  SquadImportPreviewPlayer,
  'sourceId' | 'name' | 'position' | 'secondaryPositions' | 'photoUrl'
>;

const eaPositions: Record<string, CardPosition> = {
  GK: 'GOL',
  RB: 'LD',
  RWB: 'LD',
  LB: 'LE',
  LWB: 'LE',
  CB: 'ZAG',
  CDM: 'VOL',
  CM: 'MC',
  CAM: 'MA',
  RM: 'PD',
  RW: 'PD',
  LM: 'PE',
  LW: 'PE',
  CF: 'CA',
  ST: 'CA',
};

// Ordered from most to least specific: generic labels ("Defender") only match after detailed ones.
const sportsDbPositions: ReadonlyArray<readonly [RegExp, CardPosition]> = [
  [/goal\s*keeper/i, 'GOL'],
  [/right[\s-]*(?:back|full[\s-]*back|wing[\s-]*back)/i, 'LD'],
  [/left[\s-]*(?:back|full[\s-]*back|wing[\s-]*back)/i, 'LE'],
  [/cent(?:re|er)[\s-]*back|^defen[cs]e$|^defender$/i, 'ZAG'],
  [/defensive[\s-]*midfield/i, 'VOL'],
  [/attacking[\s-]*midfield/i, 'MA'],
  [/right[\s-]*(?:wing|winger|midfield)/i, 'PD'],
  [/left[\s-]*(?:wing|winger|midfield)/i, 'PE'],
  [/striker|forward|attacker/i, 'CA'],
  [/wing/i, 'PD'],
  [/midfield/i, 'MC'],
];

const profile = (
  pace: number,
  finishing: number,
  passing: number,
  dribbling: number,
  control: number,
  marking: number,
  attack: number,
  creation: number,
  defense: number,
) => ({ pace, finishing, passing, dribbling, control, marking, attack, creation, defense });

// Offsets applied to the chosen overall when the source has no attributes.
const estimatedProfiles: Record<CardPosition, Omit<Ratings, 'overall'>> = {
  GOL: profile(-30, -55, -20, -40, -30, 0, -55, -25, 0),
  ZAG: profile(-12, -35, -15, -20, -12, 3, -35, -18, 3),
  LD: profile(3, -25, -6, -6, -6, -3, -22, -6, -3),
  LE: profile(3, -25, -6, -6, -6, -3, -22, -6, -3),
  VOL: profile(-10, -18, -2, -8, -3, -2, -18, -4, -2),
  MC: profile(-6, -10, 2, -2, 1, -15, -10, 1, -15),
  MA: profile(-3, -4, 2, 2, 2, -35, -4, 2, -35),
  PD: profile(5, -5, -5, 3, -2, -40, -5, -3, -40),
  PE: profile(5, -5, -5, 3, -2, -40, -5, -3, -40),
  CA: profile(1, 3, -12, -4, -3, -45, 3, -10, -45),
};

export function eaPosition(value: string): CardPosition | null {
  return eaPositions[value.toUpperCase()] ?? null;
}

export function sportsDbPosition(value: string): CardPosition {
  const label = value.trim();
  return sportsDbPositions.find(([pattern]) => pattern.test(label))?.[1] ?? 'MC';
}

export function eaRatings(
  position: CardPosition,
  overall: number,
  stat: (name: string) => number,
): Ratings {
  if (position === 'GOL') {
    // EA stores goalkeeper face stats (DIV/HAN/KIC/REF/SPD/POS) in the outfield keys.
    const goalkeeping = average(
      stat('gkDiving'),
      stat('gkHandling'),
      stat('gkPositioning'),
      stat('gkReflexes'),
    );
    const passing = average(stat('shortPassing'), stat('longPassing'));
    const dribbling = stat('dribbling');
    return clampRatings({
      overall,
      pace: average(stat('acceleration'), stat('sprintSpeed')),
      finishing: stat('finishing'),
      passing,
      dribbling,
      control: stat('ballControl'),
      marking: goalkeeping,
      attack: stat('finishing'),
      creation: average(passing, dribbling),
      defense: goalkeeping,
    });
  }
  return clampRatings({
    overall,
    pace: stat('pac'),
    finishing: stat('sho'),
    passing: stat('pas'),
    dribbling: stat('dri'),
    control: stat('ballControl'),
    marking: stat('def'),
    attack: stat('sho'),
    creation: average(stat('pas'), stat('dri')),
    defense: stat('def'),
  });
}

export function estimatedRatings(position: CardPosition, overall: number): Ratings {
  const offsets = estimatedProfiles[position];
  return clampRatings({
    overall,
    ...(Object.fromEntries(
      Object.entries(offsets).map(([key, offset]) => [key, overall + offset]),
    ) as typeof offsets),
  });
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function cardSlug(parts: readonly string[], taken: Set<string>): string {
  const base = truncateSlug(parts.map(slugify).filter(Boolean).join('-') || 'jogador', 96);
  let slug = base;
  for (let suffix = 2; taken.has(slug); suffix += 1) slug = `${base}-${suffix}`;
  taken.add(slug);
  return slug;
}

export function initials(name: string): string {
  return (
    name
      .replace(/\([^)]*\)/g, '')
      .split(/\s+/)
      .filter((word) => word && !['da', 'de', 'do', 'of', 'the', 'fc'].includes(word.toLowerCase()))
      .slice(0, 3)
      .map((word) => word[0])
      .join('')
      .toLocaleUpperCase('pt-BR') || 'FC'
  );
}

function truncateSlug(value: string, length: number): string {
  return value.length <= length ? value : value.slice(0, length).replace(/-+$/, '');
}

function average(...values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clampRatings(ratings: Ratings): Ratings {
  return Object.fromEntries(
    Object.entries(ratings).map(([key, value]) => [
      key,
      key === 'overall' ? value : Math.min(99, Math.max(1, Math.round(value))),
    ]),
  ) as Ratings;
}
