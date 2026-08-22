import type { LucroResponse } from '@futhub/api-client';

export function formatCommandResult(result: LucroResponse, now: Date): string {
  const availableAt = new Date(result.availableAt);
  if (!Number.isFinite(availableAt.getTime())) throw new Error('API returned an invalid date.');
  const available = `<t:${Math.floor(availableAt.getTime() / 1000)}:F>`;
  if (result.kind === 'cooldown') {
    const remaining = Math.max(0, Math.ceil((availableAt.getTime() - now.getTime()) / 1000));
    return `Aguarde ${remaining}s. Lucro disponível em ${available}.`;
  }
  const rewards = result.progression.rewards.length
    ? ` Recompensas: ${result.progression.rewards.map((reward) => `+${reward.quantity} ${reward.type}`).join(', ')}.`
    : '';
  return `${result.reward.message} (+${result.reward.value}). Saldo: ${result.balance}. XP: +${result.progression.gainedXp} (${result.progression.xp}/${result.progression.nextLevelXp}). Nível: ${result.progression.level}.${rewards} Próximo lucro: ${available}.`;
}
