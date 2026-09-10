import {
  type PackEffect,
  type PackStudioDraft,
  type PackTexture,
  packEffectOptions,
  packTextureOptions,
} from './pack-studio-model';

export const packStudioProjectVersion = 1 as const;
const maxFrontImageDataUrlLength = 8_000_000;

type PackStudioProject = Readonly<{
  version: typeof packStudioProjectVersion;
  kind: 'futhub-pack';
  metadata: Readonly<{ name: string }>;
  pack: Readonly<{
    name: string;
    cardsAmount: number;
    price: number;
    limitPerUser: number;
  }>;
  presentation: Readonly<{
    color: string;
    accentColor: string;
    textColor: string;
    effect: PackEffect;
    frontImage: string;
    texture: PackTexture;
    textureOpacity: number;
    tintOpacity: number;
    headline: string;
    headlineSize: number;
    headlineX: number;
    headlineY: number;
    kicker: string;
    kickerX: number;
    kickerY: number;
  }>;
}>;

export type PackStudioProjectParseResult =
  | Readonly<{ kind: 'success'; draft: PackStudioDraft }>
  | Readonly<{ kind: 'invalid'; message: string }>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readInteger(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
}

function readText(value: unknown, maxLength: number, required = true): string | null {
  if (typeof value !== 'string' || value.length > maxLength) return null;
  return required && !value.trim() ? null : value;
}

function readColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value) ? value : null;
}

function readFrontImage(value: unknown): string | null {
  if (value === undefined) return '';
  return typeof value === 'string' &&
    value.length <= maxFrontImageDataUrlLength &&
    (value === '' || /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(value))
    ? value
    : null;
}

function isPackEffect(value: unknown): value is PackEffect {
  return packEffectOptions.some((option) => option.id === value);
}

function isPackTexture(value: unknown): value is PackTexture {
  return packTextureOptions.some((option) => option.id === value);
}

function invalid(message = 'Arquivo .futhub inválido.'): PackStudioProjectParseResult {
  return { kind: 'invalid', message };
}

export function packStudioProject(draft: PackStudioDraft): PackStudioProject {
  return {
    version: packStudioProjectVersion,
    kind: 'futhub-pack',
    metadata: { name: draft.name.trim() || 'Novo pack' },
    pack: {
      name: draft.name,
      cardsAmount: draft.cardsAmount,
      price: draft.price,
      limitPerUser: draft.limitPerUser,
    },
    presentation: {
      color: draft.color,
      accentColor: draft.accentColor,
      textColor: draft.textColor,
      effect: draft.effect,
      frontImage: draft.frontImage,
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
    },
  };
}

export function packStudioProjectJson(draft: PackStudioDraft): string {
  return `${JSON.stringify(packStudioProject(draft), null, 2)}\n`;
}

export function parsePackStudioProject(value: unknown): PackStudioProjectParseResult {
  if (
    !isRecord(value) ||
    value.version !== packStudioProjectVersion ||
    value.kind !== 'futhub-pack'
  )
    return invalid();

  const pack = value.pack;
  const presentation = value.presentation;
  if (!isRecord(pack) || !isRecord(presentation)) return invalid();

  const name = readText(pack.name, 100);
  const cardsAmount = readInteger(pack.cardsAmount, 1, 100);
  const price = readInteger(pack.price, 0, 1_000_000);
  const limitPerUser = readInteger(pack.limitPerUser, 0, 1_000_000);
  const color = readColor(presentation.color);
  const accentColor = readColor(presentation.accentColor);
  const textColor = readColor(presentation.textColor);
  const headline = readText(presentation.headline, 18);
  const kicker = readText(presentation.kicker, 60, false);
  const headlineSize = readInteger(presentation.headlineSize, 24, 100);
  const headlineX = readInteger(presentation.headlineX, 80, 520);
  const headlineY = readInteger(presentation.headlineY, 190, 470);
  const kickerX = readInteger(presentation.kickerX, 80, 520);
  const kickerY = readInteger(presentation.kickerY, 120, 300);
  const textureOpacity = readInteger(presentation.textureOpacity, 0, 65);
  const tintOpacity = readInteger(presentation.tintOpacity, 0, 42);
  const effect = presentation.effect;
  const frontImage = readFrontImage(presentation.frontImage);
  const texture = presentation.texture;

  if (
    name === null ||
    cardsAmount === null ||
    price === null ||
    limitPerUser === null ||
    color === null ||
    accentColor === null ||
    textColor === null ||
    headline === null ||
    kicker === null ||
    headlineSize === null ||
    headlineX === null ||
    headlineY === null ||
    kickerX === null ||
    kickerY === null ||
    textureOpacity === null ||
    tintOpacity === null ||
    !isPackEffect(effect) ||
    frontImage === null ||
    !isPackTexture(texture)
  )
    return invalid('Arquivo .futhub contém valores não suportados.');

  return {
    kind: 'success',
    draft: {
      name,
      cardsAmount,
      price,
      limitPerUser,
      color,
      accentColor,
      textColor,
      effect,
      frontImage,
      texture,
      textureOpacity,
      tintOpacity,
      headline,
      headlineSize,
      headlineX,
      headlineY,
      kicker,
      kickerX,
      kickerY,
    },
  };
}

export function parsePackStudioProjectJson(json: string): PackStudioProjectParseResult {
  try {
    return parsePackStudioProject(JSON.parse(json));
  } catch {
    return invalid('Arquivo .futhub não contém JSON válido.');
  }
}

export function packStudioProjectFileName(draft: PackStudioDraft): string {
  const slug = draft.name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug || 'pack'}.futhub`;
}
