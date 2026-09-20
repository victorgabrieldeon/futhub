import { expect, test } from 'vitest';

import { calculateClubProjection } from './club.service.js';

test('adds the weekly sponsor payout after three matches', () => {
  expect(
    calculateClubProjection({ balance: 500, stadiumLevel: 2, weeklyMatches: 3, payroll: 80 }),
  ).toMatchObject({
    sponsor: {
      name: 'Comércio Local',
      completed: true,
      weeklyMatches: 3,
      weeklyGoal: 3,
      payout: 300,
    },
    stadium: { ticketRevenue: 400, maintenance: 100 },
    payroll: 80,
    projectedNet: 520,
  });
});
