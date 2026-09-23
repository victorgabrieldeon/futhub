import { createHmac, randomBytes as secureRandomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_MS = 15 * 60_000;
const MAX_SESSIONS = 1_000;
const SESSION_ID_BYTES = 12;
const SIGNATURE_LENGTH = 16;
const VERSION = 'ls1';

const CARD_POSITIONS = ['GOL', 'LD', 'LE', 'ZAG', 'VOL', 'MA', 'MC', 'PD', 'PE', 'CA'] as const;
export type CardPosition = (typeof CARD_POSITIONS)[number];

export class StoreSessionId {
  private constructor(readonly value: string) {}

  static fromBytes(bytes: Uint8Array): StoreSessionId {
    return new StoreSessionId(Buffer.from(bytes).toString('base64url'));
  }

  static fromCustomId(value: string): StoreSessionId {
    return new StoreSessionId(value);
  }
}

export type StoreFilters = {
  readonly positions: readonly CardPosition[];
  readonly minOverall: number;
  readonly maxOverall: number;
  readonly teamId: string | null;
  readonly collectionId: string | null;
  readonly sort: 'recent' | 'overall' | 'name';
};

export type StoreCatalogOption = {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
};

export type StoreCatalog = {
  readonly teams: readonly StoreCatalogOption[];
  readonly collections: readonly StoreCatalogOption[];
};

export type StoreCard = {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string;
  readonly overall: number;
  readonly position: CardPosition;
  readonly secondaryPositions: readonly CardPosition[];
  readonly defense: number;
  readonly attack: number;
  readonly creation: number;
  readonly passing: number;
  readonly control: number;
  readonly marking: number;
  readonly pace: number;
  readonly dribbling: number;
  readonly finishing: number;
  readonly price: number;
  readonly team: StoreCatalogOption;
  readonly collection: StoreCatalogOption;
};

export type StoreSelection =
  | { readonly kind: 'none' }
  | { readonly kind: 'selected'; readonly cardId: string };

export type StorePurchase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'purchasing'; readonly cardId: string }
  | {
      readonly kind: 'purchased';
      readonly cardId: string;
      readonly price: number;
      readonly balance: number;
    };

export type StorePacks = {
  readonly tab: 'packs';
  readonly page: number;
  readonly favoritePackIds: readonly string[];
};

export type StoreSessionState =
  | StorePacks
  | {
      readonly tab: 'contratar';
      readonly filters: StoreFilters;
      readonly page: number;
      readonly total: number;
      readonly totalPages: number;
      readonly catalog: StoreCatalog;
      readonly items: readonly StoreCard[];
      readonly selection: StoreSelection;
      readonly pickerPage: number;
      readonly purchase: StorePurchase;
    };

export type StoreSession = {
  readonly id: StoreSessionId;
  readonly ownerId: string;
  readonly state: StoreSessionState;
  readonly expiresAt: number;
  readonly lastAccessAt: number;
};

export type StoreAction =
  | { readonly action: 'tab'; readonly arg: 'packs' | 'contratar' }
  | { readonly action: 'page'; readonly arg: string }
  | { readonly action: 'picker'; readonly arg: string }
  | {
      readonly action:
        | 'select'
        | 'buy'
        | 'favorite'
        | 'inspect-pack'
        | 'purchase-pack'
        | 'detail-overview'
        | 'detail-config';
      readonly arg: string;
    }
  | {
      readonly action:
        | 'pack-menu'
        | 'card-menu'
        | 'position-menu'
        | 'sort-menu'
        | 'page-label'
        | 'filters'
        | 'back';
      readonly arg: '_';
    };

export type SessionAccess =
  | { readonly kind: 'owned'; readonly session: StoreSession }
  | { readonly kind: 'expired' }
  | { readonly kind: 'foreign' };

type InvalidReason = 'format' | 'version' | 'action' | 'argument' | 'signature';

export type ParsedStoreAction =
  | { readonly kind: 'owned'; readonly session: StoreSession; readonly action: StoreAction }
  | { readonly kind: 'expired' }
  | { readonly kind: 'foreign' }
  | { readonly kind: 'invalid'; readonly reason: InvalidReason };

type StoreSessionManagerOptions = {
  readonly clock?: () => number;
  readonly randomBytes?: (size: number) => Uint8Array;
  readonly secret?: string | Uint8Array;
};

export class InvalidStoreActionError extends Error {
  readonly name = 'InvalidStoreActionError';

  constructor(readonly action: StoreAction) {
    super(`Invalid store action: ${action.action}`);
  }
}

export class StoreSessionManager {
  readonly #sessions = new Map<string, StoreSession>();
  readonly #clock: () => number;
  readonly #randomBytes: (size: number) => Uint8Array;
  readonly #secret: string | Uint8Array;

  constructor(options: StoreSessionManagerOptions = {}) {
    this.#clock = options.clock ?? Date.now;
    this.#randomBytes = options.randomBytes ?? secureRandomBytes;
    this.#secret = options.secret ?? secureRandomBytes(32);
  }

  get size(): number {
    return this.#sessions.size;
  }

  create(ownerId: string, state: StoreSessionState): StoreSession {
    const now = this.#clock();
    this.#cleanup(now, 1);
    let id = StoreSessionId.fromBytes(this.#randomBytes(SESSION_ID_BYTES));
    while (this.#sessions.has(id.value)) {
      id = StoreSessionId.fromBytes(this.#randomBytes(SESSION_ID_BYTES));
    }
    const session = { id, ownerId, state, expiresAt: now + SESSION_TTL_MS, lastAccessAt: now };
    this.#sessions.set(id.value, session);
    return session;
  }

  get(id: StoreSessionId, ownerId: string): SessionAccess {
    const current = this.#sessions.get(id.value);
    if (!current) return { kind: 'expired' };
    if (current.ownerId !== ownerId) return { kind: 'foreign' };
    const now = this.#clock();
    if (current.expiresAt <= now) {
      this.#sessions.delete(id.value);
      return { kind: 'expired' };
    }
    this.#cleanup(now, 0);
    const session = { ...current, expiresAt: now + SESSION_TTL_MS, lastAccessAt: now };
    this.#sessions.set(id.value, session);
    return { kind: 'owned', session };
  }

  replaceState(id: StoreSessionId, ownerId: string, state: StoreSessionState): SessionAccess {
    const access = this.get(id, ownerId);
    if (access.kind !== 'owned') return access;
    const session = { ...access.session, state };
    this.#sessions.set(id.value, session);
    return { kind: 'owned', session };
  }

  replaceStateIf(
    id: StoreSessionId,
    ownerId: string,
    expected: StoreSessionState,
    state: StoreSessionState,
  ): SessionAccess | { readonly kind: 'stale'; readonly session: StoreSession } {
    const access = this.get(id, ownerId);
    if (access.kind !== 'owned') return access;
    if (access.session.state !== expected) return { kind: 'stale', session: access.session };
    const session = { ...access.session, state };
    this.#sessions.set(id.value, session);
    return { kind: 'owned', session };
  }

  sign(id: StoreSessionId, action: StoreAction): string {
    if (!isValidAction(action.action, action.arg)) throw new InvalidStoreActionError(action);
    const payload = `${VERSION}:${id.value}:${action.action}:${action.arg}`;
    return `${payload}:${this.#signature(payload)}`;
  }

  parse(customId: string, ownerId: string): ParsedStoreAction {
    if (customId.length >= 100) return { kind: 'invalid', reason: 'format' };
    const parts = customId.split(':');
    if (parts.length !== 5) return { kind: 'invalid', reason: 'format' };
    const [version, sessionValue, actionValue, arg, signature] = parts;
    if (!version || !sessionValue || !actionValue || !arg || !signature)
      return { kind: 'invalid', reason: 'format' };
    if (version !== VERSION) return { kind: 'invalid', reason: 'version' };
    if (!/^[A-Za-z0-9_-]{16}$/.test(sessionValue)) return { kind: 'invalid', reason: 'format' };
    const action = parseAction(actionValue, arg);
    if (action.kind === 'invalid') return action;
    const payload = `${version}:${sessionValue}:${actionValue}:${arg}`;
    if (!this.#matchesSignature(payload, signature))
      return { kind: 'invalid', reason: 'signature' };
    const access = this.get(StoreSessionId.fromCustomId(sessionValue), ownerId);
    if (access.kind !== 'owned') return access;
    return { kind: 'owned', session: access.session, action: action.value };
  }

  #cleanup(now: number, reserve: number): void {
    for (const [id, session] of this.#sessions) {
      if (session.expiresAt <= now) this.#sessions.delete(id);
    }
    while (this.#sessions.size + reserve > MAX_SESSIONS) {
      let oldest: StoreSession | undefined;
      for (const session of this.#sessions.values()) {
        if (!oldest || session.lastAccessAt < oldest.lastAccessAt) oldest = session;
      }
      if (!oldest) return;
      this.#sessions.delete(oldest.id.value);
    }
  }

  #signature(payload: string): string {
    return createHmac('sha256', this.#secret)
      .update(payload)
      .digest('base64url')
      .slice(0, SIGNATURE_LENGTH);
  }

  #matchesSignature(payload: string, candidate: string): boolean {
    const expected = this.#signature(payload);
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
  }
}

export function createStoreSessionManager(
  options: StoreSessionManagerOptions = {},
): StoreSessionManager {
  return new StoreSessionManager(options);
}

function parseAction(
  action: string,
  arg: string,
):
  | { readonly kind: 'valid'; readonly value: StoreAction }
  | { readonly kind: 'invalid'; readonly reason: InvalidReason } {
  switch (action) {
    case 'tab':
      if (arg !== 'packs' && arg !== 'contratar') return { kind: 'invalid', reason: 'argument' };
      return { kind: 'valid', value: { action, arg } };
    case 'page':
      return /^[1-9]\d{0,3}$/.test(arg)
        ? { kind: 'valid', value: { action, arg } }
        : { kind: 'invalid', reason: 'argument' };
    case 'picker':
      return /^(0|[1-9]\d{0,2})$/.test(arg)
        ? { kind: 'valid', value: { action, arg } }
        : { kind: 'invalid', reason: 'argument' };
    case 'select':
    case 'buy':
      return isUuid(arg)
        ? { kind: 'valid', value: { action, arg } }
        : { kind: 'invalid', reason: 'argument' };
    case 'favorite':
    case 'inspect-pack':
    case 'purchase-pack':
    case 'detail-overview':
    case 'detail-config':
      return isPackId(arg)
        ? { kind: 'valid', value: { action, arg } }
        : { kind: 'invalid', reason: 'argument' };
    case 'pack-menu':
    case 'card-menu':
    case 'position-menu':
    case 'sort-menu':
    case 'page-label':
    case 'filters':
    case 'back':
      return arg === '_'
        ? { kind: 'valid', value: { action, arg } }
        : { kind: 'invalid', reason: 'argument' };
    default:
      return { kind: 'invalid', reason: 'action' };
  }
}

function isValidAction(action: string, arg: string): boolean {
  if (action === 'tab') return arg === 'packs' || arg === 'contratar';
  if (action === 'page') return /^[1-9]\d{0,3}$/.test(arg);
  if (action === 'picker') return /^(0|[1-9]\d{0,2})$/.test(arg);
  if (action === 'select' || action === 'buy') return isUuid(arg);
  if (
    action === 'favorite' ||
    action === 'inspect-pack' ||
    action === 'purchase-pack' ||
    action === 'detail-overview' ||
    action === 'detail-config'
  )
    return isPackId(arg);
  return (
    (action === 'pack-menu' ||
      action === 'card-menu' ||
      action === 'position-menu' ||
      action === 'sort-menu' ||
      action === 'page-label' ||
      action === 'filters' ||
      action === 'back') &&
    arg === '_'
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isPackId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,80}$/.test(value);
}
