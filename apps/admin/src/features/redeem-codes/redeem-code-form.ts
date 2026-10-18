import type { AdminRedeemCode, AdminRedeemCodeInput } from '@futhub/api-client';

export type RewardType = AdminRedeemCodeInput['reward']['type'];
export type RedeemCodeStatus = 'active' | 'inactive' | 'expired' | 'exhausted';

export type RedeemCodeDraft = Readonly<{
  code: string;
  rewardType: RewardType;
  amount: string;
  resourceId: string;
  maxClaims: string;
  /** `datetime-local` value in the browser time zone; empty means no expiry. */
  expiresAt: string;
  active: boolean;
}>;

export const rewardTypeLabels: Record<RewardType, string> = {
  balance: 'Moedas',
  card: 'Carta',
  pack: 'Pack',
  field: 'Campo',
};

export const codePattern = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export const emptyDraft: RedeemCodeDraft = {
  code: '',
  rewardType: 'balance',
  amount: '100',
  resourceId: '',
  maxClaims: '',
  expiresAt: '',
  active: true,
};

/** Mirrors the API normalization so the admin sees the code players will type. */
export function canonicalCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

export function redeemCodeStatus(code: AdminRedeemCode, now: Date): RedeemCodeStatus {
  if (!code.active) return 'inactive';
  if (code.expiresAt && new Date(code.expiresAt) <= now) return 'expired';
  if (code.maxClaims !== null && code.claims >= code.maxClaims) return 'exhausted';
  return 'active';
}

export function rewardLabel(reward: AdminRedeemCode['reward']): string {
  if (reward.type === 'balance') return `${reward.amount.toLocaleString('pt-BR')} moedas`;
  const name = reward.resourceName ?? 'recurso removido';
  const label = rewardTypeLabels[reward.type].toLowerCase();
  return reward.amount > 1 ? `${reward.amount}× ${label} ${name}` : `${label} ${name}`;
}

function localDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function draftFrom(code: AdminRedeemCode): RedeemCodeDraft {
  return {
    code: code.code,
    rewardType: code.reward.type,
    amount: String(code.reward.amount),
    resourceId: code.reward.resourceId ?? '',
    maxClaims: code.maxClaims === null ? '' : String(code.maxClaims),
    expiresAt: code.expiresAt ? localDateTime(code.expiresAt) : '',
    active: code.active,
  };
}

/** Returns the API payload or the first problem an admin must fix. */
export function inputFrom(
  draft: RedeemCodeDraft,
): { input: AdminRedeemCodeInput } | { error: string } {
  if (!codePattern.test(draft.code))
    return { error: 'Use de 3 a 32 caracteres: letras, números, hífen ou sublinhado.' };
  const amount = Number(draft.amount);
  if (!Number.isSafeInteger(amount) || amount < 1)
    return { error: 'A quantidade deve ser um número inteiro maior que zero.' };
  if (draft.rewardType === 'field' && amount !== 1)
    return { error: 'Campos são concedidos uma única vez; use quantidade 1.' };
  if (draft.rewardType !== 'balance' && !draft.resourceId)
    return { error: `Escolha ${rewardTypeLabels[draft.rewardType].toLowerCase()} da recompensa.` };
  const maxClaims = draft.maxClaims.trim() ? Number(draft.maxClaims) : null;
  if (maxClaims !== null && (!Number.isSafeInteger(maxClaims) || maxClaims < 1))
    return { error: 'O limite de resgates deve ser vazio ou um inteiro maior que zero.' };
  const expiresAt = draft.expiresAt ? new Date(draft.expiresAt) : null;
  if (expiresAt && !Number.isFinite(expiresAt.getTime()))
    return { error: 'Data de expiração inválida.' };
  return {
    input: {
      code: draft.code,
      reward: {
        type: draft.rewardType,
        amount,
        resourceId: draft.rewardType === 'balance' ? null : draft.resourceId,
      },
      maxClaims,
      expiresAt: expiresAt?.toISOString() ?? null,
      active: draft.active,
    },
  };
}

/** Letters and digits players cannot confuse when typing (no 0/O, 1/I/L). */
const codeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Suggests a fresh code such as `FUT-7KQ2MX`; `random` is injectable for tests. */
export function generateCode(random: () => number = Math.random): string {
  let suffix = '';
  for (let index = 0; index < 6; index += 1)
    suffix += codeAlphabet[Math.floor(random() * codeAlphabet.length)];
  return `FUT-${suffix}`;
}

/** `datetime-local` value `hours` after `now`, for the expiry shortcuts. */
export function expiryAfter(now: Date, hours: number): string {
  return localDateTime(new Date(now.getTime() + hours * 3_600_000).toISOString());
}

const relativeUnits: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** Human distance to the expiry, e.g. `em 3 dias` or `expirou há 2 horas`. */
export function expiryLabel(expiresAt: string | null, now: Date): string {
  if (!expiresAt) return 'Nunca';
  const delta = new Date(expiresAt).getTime() - now.getTime();
  const [unit, size] = relativeUnits.find(([, ms]) => Math.abs(delta) >= ms) ?? relativeUnits[2];
  const value = Math.trunc(delta / size) || (delta <= 0 ? -1 : 1);
  const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'always' }).format(value, unit);
  return delta <= 0 ? `expirou ${relative}` : relative;
}

/** Share of the claim limit already used, or `null` for unlimited codes. */
export function claimsShare(code: Pick<AdminRedeemCode, 'claims' | 'maxClaims'>): number | null {
  if (code.maxClaims === null) return null;
  return Math.min(1, code.claims / Math.max(1, code.maxClaims));
}

/** Searches by code and by what the code grants (`moedas`, card or pack name…). */
export function matchesQuery(code: AdminRedeemCode, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase('pt-BR');
  if (!needle) return true;
  return (
    code.code.toLocaleLowerCase('pt-BR').includes(needle) ||
    rewardLabel(code.reward).toLocaleLowerCase('pt-BR').includes(needle)
  );
}
