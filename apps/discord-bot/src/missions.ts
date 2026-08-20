import type { MissionDtoCadence, MissionsResponse } from '@dreamfut/api-client';

const CADENCE_LABEL: Record<MissionDtoCadence, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

function formatExpiry(value: string): string {
  const expiresAt = new Date(value);
  if (!Number.isFinite(expiresAt.getTime()))
    throw new Error('API returned an invalid mission expiry.');
  return `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`;
}

export function formatMissions(result: MissionsResponse): string {
  if (result.missions.length === 0) return 'Nenhuma missão ativa agora.';
  const output = result.missions
    .map((mission) => {
      const status = mission.claimed
        ? 'concluída; recompensa concedida'
        : `${mission.progress}/${mission.goal}`;
      const reward = mission.reward
        ? ` Recompensa: +${mission.reward.quantity} ${mission.reward.type}.`
        : '';
      return `**${CADENCE_LABEL[mission.cadence]}** — ${mission.title}: ${status}. Expira ${formatExpiry(mission.expiresAt)}.${reward}`;
    })
    .join('\n');
  return output.length <= 2_000 ? output : `${output.slice(0, 1_997)}...`;
}
