import type { Pack, PackInput, PackPresentation } from '../packs/actions';
import { emptyPack, packInput } from '../packs/pack-form';

export const packEffectOptions = [
  { id: 'foil', label: 'Foil' },
  { id: 'holographic', label: 'Holográfico' },
  { id: 'chrome', label: 'Chrome' },
] as const;

export const packTextureOptions = [
  { id: 'none', label: 'Sem decoração' },
  { id: 'aura', label: 'Aura' },
  { id: 'fire', label: 'Fogo' },
  { id: 'lightning', label: 'Raios' },
] as const;

export type PackEffect = (typeof packEffectOptions)[number]['id'];
export type PackTexture = (typeof packTextureOptions)[number]['id'];

export type PackStudioDraft = Readonly<{
  accentColor: string;
  cardsAmount: number;
  color: string;
  effect: PackEffect;
  frontImage: string;
  headline: string;
  headlineSize: number;
  headlineX: number;
  headlineY: number;
  kicker: string;
  kickerX: number;
  kickerY: number;
  limitPerUser: number;
  name: string;
  price: number;
  textColor: string;
  textureOpacity: number;
  texture: PackTexture;
  tintOpacity: number;
}>;

export const packStudioArtKeys = [
  'accentColor',
  'color',
  'effect',
  'textColor',
  'texture',
  'textureOpacity',
  'tintOpacity',
] as const;
export type PackStudioArt = Pick<PackStudioDraft, (typeof packStudioArtKeys)[number]>;

export const defaultPackStudioArt = {
  accentColor: '#765cff',
  color: '#2d16d8',
  effect: 'foil',
  textColor: '#ffffff',
  texture: 'aura',
  textureOpacity: 42,
  tintOpacity: 16,
} satisfies PackStudioArt;

export const packStudioPresets: readonly Readonly<{
  label: string;
  description: string;
  art: PackStudioArt;
}>[] = [
  { label: 'Padrão', description: 'Violeta · Foil', art: defaultPackStudioArt },
  {
    label: 'Neon',
    description: 'Azul elétrico · Holográfico',
    art: {
      ...defaultPackStudioArt,
      color: '#1236ce',
      accentColor: '#79d9ff',
      effect: 'holographic',
    },
  },
  {
    label: 'Gold',
    description: 'Dourado · Foil',
    art: {
      ...defaultPackStudioArt,
      color: '#3e3110',
      accentColor: '#e9dc98',
      texture: 'none',
    },
  },
  {
    label: 'Ice',
    description: 'Gelo · Chrome',
    art: {
      ...defaultPackStudioArt,
      color: '#15577a',
      accentColor: '#c7efff',
      effect: 'chrome',
    },
  },
];

export function defaultPackStudioDraft(): PackStudioDraft {
  return {
    cardsAmount: 3,
    frontImage: '',
    headline: '3 CARTAS',
    headlineSize: 63,
    headlineX: 300,
    headlineY: 260,
    kicker: 'FUTHUB',
    kickerX: 300,
    kickerY: 152,
    limitPerUser: 10,
    name: 'Pack padrão',
    price: 15,
    ...defaultPackStudioArt,
  };
}

export function packStudioDraft(pack: Pack): PackStudioDraft {
  return {
    ...defaultPackStudioDraft(),
    ...pack.presentation,
    cardsAmount: pack.cardsAmount,
    color: pack.presentation?.color ?? pack.color,
    headline: pack.presentation?.headline ?? `${pack.cardsAmount} CARTAS`,
    limitPerUser: pack.limitPerUser,
    name: pack.name,
    price: pack.price,
  };
}

export function packStudioInput(draft: PackStudioDraft, pack?: Pack): PackInput {
  const base = pack ? packInput(pack) : emptyPack();

  return {
    ...base,
    cardsAmount: draft.cardsAmount,
    color: draft.color,
    limitPerUser: draft.limitPerUser,
    name: draft.name.trim(),
    price: draft.price,
    presentation: {
      schemaVersion: 1,
      color: draft.color,
      accentColor: draft.accentColor,
      textColor: draft.textColor,
      effect: draft.effect,
      texture: draft.texture,
      textureOpacity: draft.textureOpacity,
      tintOpacity: draft.tintOpacity,
      headline: draft.headline,
      headlineSize: draft.headlineSize,
      headlineX: draft.headlineX,
      headlineY: draft.headlineY,
      kicker: draft.kicker,
      kickerX: draft.kickerX,
      kickerY: draft.kickerY,
    } satisfies PackPresentation,
  };
}
