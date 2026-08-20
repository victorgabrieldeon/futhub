import { describe, expect, it } from 'vitest';

import { missionCycle } from './mission-period.js';

describe('missionCycle', () => {
  it('fecha ciclo diário e mensal no próximo limite UTC', () => {
    expect(missionCycle('daily', new Date('2026-08-20T23:59:59Z'))).toEqual({
      key: '2026-08-20',
      expiresAt: new Date('2026-08-21T00:00:00Z'),
    });
    expect(missionCycle('monthly', new Date('2026-12-31T23:59:59Z'))).toEqual({
      key: '2026-12',
      expiresAt: new Date('2027-01-01T00:00:00Z'),
    });
  });

  it('usa ano ISO para ciclo semanal na virada do ano', () => {
    expect(missionCycle('weekly', new Date('2025-12-29T12:00:00Z'))).toEqual({
      key: '2026-W01',
      expiresAt: new Date('2026-01-05T00:00:00Z'),
    });
  });
});
