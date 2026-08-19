import { describe, expect, it } from 'vitest';

import { getXpForLevel, progressXp } from './progression.js';

describe('XP progression', () => {
  it('uses Futverse level curve', () => {
    expect(getXpForLevel(1)).toBe(100);
    expect(getXpForLevel(2)).toBe(250);
    expect(getXpForLevel(3)).toBe(500);
  });

  it('levels up when XP reaches exact threshold', () => {
    expect(progressXp(90, 1, 10)).toEqual({ xp: 0, level: 2, crossedLevels: [1] });
  });

  it('carries overflow through multiple levels', () => {
    expect(progressXp(0, 1, 400)).toEqual({ xp: 50, level: 3, crossedLevels: [1, 2] });
  });
});
