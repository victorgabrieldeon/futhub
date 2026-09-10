import type { Pack, PackInput } from '../packs/actions';
import { emptyPack, packInput } from '../packs/pack-form';

export const packEffectOptions = [
  { id: 'foil', label: 'Foil' },
  { id: 'holographic', label: 'Holográfico' },
  { id: 'chrome', label: 'Chrome' },
] as const;

export const packTextureOptions = [
  { id: 'mesh', label: 'Malha' },
  { id: 'shards', label: 'Fragmentos' },
  { id: 'rings', label: 'Anéis' },
] as const;

export type PackEffect = (typeof packEffectOptions)[number]['id'];
export type PackTexture = (typeof packTextureOptions)[number]['id'];

export type PackStudioDraft = Readonly<{
  accentColor: string;
  cardsAmount: number;
  color: string;
  effect: PackEffect;
  headline: string;
  headlineSize: number;
  headlineX: number;
  headlineY: number;
  kicker: string;
  limitPerUser: number;
  name: string;
  price: number;
  textColor: string;
  textureOpacity: number;
  texture: PackTexture;
  tintOpacity: number;
}>;

export function defaultPackStudioDraft(): PackStudioDraft {
  return {
    accentColor: '#e9dc98',
    cardsAmount: 3,
    color: '#3b20d8',
    effect: 'foil',
    headline: '3 CARTAS',
    headlineSize: 42,
    headlineX: 300,
    headlineY: 250,
    kicker: 'MINIPACK',
    limitPerUser: 10,
    name: '',
    price: 15,
    textColor: '#ffffff',
    textureOpacity: 32,
    texture: 'mesh',
    tintOpacity: 0,
  };
}

export function packStudioDraft(pack: Pack): PackStudioDraft {
  return {
    ...defaultPackStudioDraft(),
    cardsAmount: pack.cardsAmount,
    color: pack.color,
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
  };
}
