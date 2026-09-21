import { randomBytes } from 'node:crypto';
import type { LeagueStatusResponse, MatchResponse } from '@futhub/api-client';

const ttlMs = 15 * 60_000;
const maxSessions = 1_000;

export type TeamPosition = 'GOL' | 'LD' | 'LE' | 'ZAG' | 'VOL' | 'MA' | 'MC' | 'PD' | 'PE' | 'CA';
export type TeamCard = {
  userCardId: string;
  name: string;
  imageUrl: string | null;
  overall: number;
  position: TeamPosition;
  secondaryPositions: TeamPosition[];
  collection: { id: string; name: string; emoji: string };
  favorite: boolean;
  holder: boolean;
  holderPosition: TeamPosition | null;
  captain: boolean;
  sellPrice: number;
  claimedAt: string;
};
export type TeamResponse = {
  balance: number;
  strength: number;
  inventoryCount: number;
  tactic: 'defensive' | 'balanced' | 'offensive';
  formation: {
    id: string;
    name: string;
    slots: { id: string; position: TeamPosition; x: number; y: number }[];
  };
  formations: {
    id: string;
    name: string;
    slots: { id: string; position: TeamPosition; x: number; y: number }[];
  }[];
  lineup: TeamCard[];
  inventory: { items: TeamCard[]; total: number; page: number; pageSize: 10; totalPages: number };
  packs: { id: string; name: string; emoji: string; quantity: number }[];
  collections: { id: string; name: string; emoji: string }[];
};
export type ClubResponse = {
  balance: number;
  stadium: {
    level: number;
    maxLevel: number;
    nextUpgradeCost: number | null;
    ticketRevenue: number;
    maintenance: number;
  };
  sponsor: {
    name: string;
    weeklyMatches: number;
    weeklyGoal: number;
    payout: number;
    completed: boolean;
  };
  payroll: number;
  projectedNet: number;
};
export type LeaguePanelState = Readonly<{
  status: LeagueStatusResponse;
  match: MatchResponse | null;
}>;
export type TeamTab = 'overview' | 'lineup' | 'inventory' | 'packs' | 'sale' | 'club' | 'league';
export type TeamFilters = {
  readonly name: string;
  readonly position: TeamPosition | null;
  readonly collectionId: string | null;
  readonly sort: 'overall' | 'name' | 'recent';
};
export type TeamSession = {
  readonly id: string;
  readonly ownerId: string;
  readonly identity: Readonly<{ id: string; name: string; avatarUrl: string | null }>;
  readonly ephemeral: boolean;
  readonly expiresAt: number;
  readonly tab: TeamTab;
  readonly filters: TeamFilters;
  readonly selectedCardId: string | null;
  readonly confirmSale: boolean;
  readonly team: TeamResponse;
  readonly club: ClubResponse | null;
  readonly league: LeaguePanelState | null;
};
export type TeamAction =
  | 'tab'
  | 'page'
  | 'auto'
  | 'tactic'
  | 'formation'
  | 'card'
  | 'position-filter'
  | 'collection-filter'
  | 'sort'
  | 'lineup'
  | 'captain'
  | 'favorite'
  | 'sell-confirm'
  | 'sell'
  | 'cancel'
  | 'search'
  | 'stadium-upgrade'
  | 'league-queue'
  | 'league-refresh';

const sessions = new Map<string, TeamSession>();

export function createTeamSession(
  input: Omit<TeamSession, 'id' | 'expiresAt'>,
  now = Date.now(),
): TeamSession {
  cleanup(now);
  while (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value ?? '');
  let id = randomBytes(12).toString('base64url');
  while (sessions.has(id)) id = randomBytes(12).toString('base64url');
  const session = { ...input, id, expiresAt: now + ttlMs };
  sessions.set(id, session);
  return session;
}

export function updateTeamSession(
  session: TeamSession,
  changes: Partial<Omit<TeamSession, 'id' | 'ownerId' | 'identity' | 'ephemeral' | 'expiresAt'>>,
): TeamSession {
  const current = sessions.get(session.id);
  if (!current || current !== session) throw new Error('Team session changed.');
  const updated = { ...current, ...changes };
  sessions.set(session.id, updated);
  return updated;
}

export function teamCustomId(session: TeamSession, action: TeamAction, argument = '_'): string {
  return `tm1:${session.id}:${action}:${argument}`;
}

export function parseTeamAction(
  customId: string,
  ownerId: string,
  now = Date.now(),
):
  | {
      readonly kind: 'owned';
      readonly session: TeamSession;
      readonly action: TeamAction;
      readonly argument: string;
    }
  | { readonly kind: 'foreign' | 'expired' | 'invalid' } {
  const [version, id, action, argument, extra] = customId.split(':');
  if (version !== 'tm1' || !id || !action || !argument || extra) return { kind: 'invalid' };
  if (!isTeamAction(action)) return { kind: 'invalid' };
  const session = sessions.get(id);
  if (!session || session.expiresAt <= now) {
    if (session) sessions.delete(id);
    return { kind: 'expired' };
  }
  if (session.ownerId !== ownerId) return { kind: 'foreign' };
  return { kind: 'owned', session, action, argument };
}

function cleanup(now: number): void {
  for (const [id, session] of sessions) if (session.expiresAt <= now) sessions.delete(id);
}

function isTeamAction(value: string): value is TeamAction {
  return [
    'tab',
    'page',
    'auto',
    'tactic',
    'formation',
    'card',
    'position-filter',
    'collection-filter',
    'sort',
    'lineup',
    'captain',
    'favorite',
    'sell-confirm',
    'sell',
    'cancel',
    'search',
    'stadium-upgrade',
    'league-queue',
    'league-refresh',
  ].includes(value);
}
