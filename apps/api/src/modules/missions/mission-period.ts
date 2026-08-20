export type MissionCadence = 'daily' | 'weekly' | 'monthly';

export type MissionCycle = Readonly<{ key: string; expiresAt: Date }>;

const dayMilliseconds = 86_400_000;

function dateAtUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function isoWeekCycle(now: Date): MissionCycle {
  const day = dateAtUtc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const monday = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * dayMilliseconds);
  const thursday = new Date(monday.getTime() + 3 * dayMilliseconds);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = dateAtUtc(isoYear, 0, 4);
  const firstMonday = new Date(
    firstThursday.getTime() - ((firstThursday.getUTCDay() + 6) % 7) * dayMilliseconds,
  );
  const week = 1 + Math.round((monday.getTime() - firstMonday.getTime()) / (7 * dayMilliseconds));
  return {
    key: `${isoYear}-W${String(week).padStart(2, '0')}`,
    expiresAt: new Date(monday.getTime() + 7 * dayMilliseconds),
  };
}

export function missionCycle(cadence: MissionCadence, now: Date): MissionCycle {
  if (!Number.isFinite(now.getTime())) throw new Error('Mission clock returned an invalid date.');
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  switch (cadence) {
    case 'daily':
      return { key: now.toISOString().slice(0, 10), expiresAt: dateAtUtc(year, month, day + 1) };
    case 'weekly':
      return isoWeekCycle(now);
    case 'monthly':
      return {
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        expiresAt: dateAtUtc(year, month + 1, 1),
      };
  }
}
