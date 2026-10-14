import { ApiClientError } from '@futhub/api-client';

export const transactionLabels: Record<string, string> = {
  purchase: 'Compra',
  sale: 'Venda',
  trade: 'Troca',
  reward: 'Recompensa',
  redeem: 'Código de resgate',
  admin: 'Ajuste do admin',
};

export const claimOriginLabels: Record<string, string> = {
  pack: 'Pack',
  redeem: 'Código',
  mission: 'Missão',
  hire: 'Mercado',
  reward: 'Recompensa',
  admin: 'Admin',
};

const coins = new Intl.NumberFormat('pt-BR');

export function formatCoins(amount: number): string {
  return `${coins.format(amount)} moedas`;
}

export function formatSignedCoins(amount: number): string {
  return `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${coins.format(Math.abs(amount))}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Parses a signed, non-zero whole number typed by the admin ("+500", "-20", "1.000"). */
export function parseBalanceAdjustment(value: string): { amount: number } | { error: string } {
  const normalized = value.replace(/[\s.]/g, '').replace('−', '-');
  if (!/^[+-]?\d+$/.test(normalized))
    return { error: 'Informe um número inteiro, como 500 ou -200.' };
  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > 100_000_000)
    return { error: 'O ajuste deve ficar entre -100.000.000 e 100.000.000.' };
  if (amount === 0) return { error: 'O ajuste não pode ser zero.' };
  return { amount };
}

export function adminErrorMessage(cause: unknown): string {
  if (cause instanceof ApiClientError && cause.status === 401) window.location.assign('/login');
  if (cause instanceof ApiClientError)
    return cause.message.replace(/^FutHub API request failed with status \d+: /, '');
  return 'Não foi possível concluir a solicitação.';
}
