import type { LucroResponse } from '@dreamfut/api-client';

export function formatCommandResult(result: LucroResponse, now: Date): string {
  const availableAt = new Date(result.availableAt);
  if (!Number.isFinite(availableAt.getTime())) throw new Error('API returned an invalid date.');
  const available = `<t:${Math.floor(availableAt.getTime() / 1000)}:F>`;
  if (result.kind === 'cooldown') {
    const remaining = Math.max(0, Math.ceil((availableAt.getTime() - now.getTime()) / 1000));
    return `Aguarde ${remaining}s. Lucro disponível em ${available}.`;
  }
  return `${result.reward.message} (+${result.reward.value}). Saldo: ${result.balance}. Próximo lucro: ${available}.`;
}
