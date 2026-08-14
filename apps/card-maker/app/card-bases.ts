export const CARD_WIDTH = '600';
export const CARD_HEIGHT = '800';

export const MAX_NAME_LENGTH = 80;
export const MAX_SLUG_LENGTH = 80;
export const MAX_LABEL_LENGTH = 32;
export const MAX_PLAYER_NAME_LENGTH = 40;

interface CardDesign {
  accentColor: string;
  backgroundColor: string;
  label: string;
  playerName: string;
  rating: string;
}

export interface CreateCardBaseBody {
  design: CardDesign;
  height: string;
  name: string;
  slug: string;
  width: string;
}

export interface SavedBase {
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isDesign(value: unknown): value is CardDesign {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.accentColor === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(value.accentColor) &&
    typeof value.backgroundColor === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(value.backgroundColor) &&
    isNonEmptyString(value.label, MAX_LABEL_LENGTH) &&
    isNonEmptyString(value.playerName, MAX_PLAYER_NAME_LENGTH) &&
    typeof value.rating === 'string' &&
    /^(?:[1-9]|[1-9][0-9])$/.test(value.rating)
  );
}

export function isCreateCardBaseBody(value: unknown): value is CreateCardBaseBody {
  if (!isObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.name, MAX_NAME_LENGTH) &&
    typeof value.slug === 'string' &&
    value.slug.length <= MAX_SLUG_LENGTH &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) &&
    value.width === CARD_WIDTH &&
    value.height === CARD_HEIGHT &&
    isDesign(value.design)
  );
}

export function isSavedBase(value: unknown): value is SavedBase {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

export function isSavedBaseList(value: unknown): value is SavedBase[] {
  return Array.isArray(value) && value.every(isSavedBase);
}
