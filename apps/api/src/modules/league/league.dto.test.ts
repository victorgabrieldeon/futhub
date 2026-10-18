import { expect, it } from 'vitest';

import { TestMatchRequestSchema } from './league.dto.js';

const identity = { id: 'player', name: 'Player', avatarUrl: null };

it('defaults old test match requests to medium without an opponent or seed', () => {
  expect(TestMatchRequestSchema.parse({ identity })).toEqual({
    identity,
    opponentId: null,
    seed: null,
    difficulty: 'medium',
  });
});

it.each(['easy', 'medium', 'hard'])('accepts CPU difficulty %s', (difficulty) => {
  expect(TestMatchRequestSchema.parse({ identity, difficulty }).difficulty).toBe(difficulty);
});

it.each([null, '', 'Easy', 'expert', 1, true, {}, ['easy']])(
  'rejects invalid CPU difficulty %j',
  (difficulty) => {
    expect(TestMatchRequestSchema.safeParse({ identity, difficulty }).success).toBe(false);
  },
);

it.each([0, -1, 1.5, 2_147_483_648, '42'])('still rejects invalid seed %j', (seed) => {
  expect(TestMatchRequestSchema.safeParse({ identity, seed }).success).toBe(false);
});
