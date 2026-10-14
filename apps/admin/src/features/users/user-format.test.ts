import { describe, expect, it } from 'vitest';
import { formatSignedCoins, parseBalanceAdjustment } from './user-format';

describe('user format', () => {
  it('parses signed balance adjustments typed by the admin', () => {
    expect(parseBalanceAdjustment('500')).toEqual({ amount: 500 });
    expect(parseBalanceAdjustment('+1.000')).toEqual({ amount: 1000 });
    expect(parseBalanceAdjustment(' -20 ')).toEqual({ amount: -20 });
    expect(parseBalanceAdjustment('−35')).toEqual({ amount: -35 });
  });

  it('rejects zero, fractions and out-of-range adjustments', () => {
    expect(parseBalanceAdjustment('0')).toHaveProperty('error');
    expect(parseBalanceAdjustment('1,5')).toHaveProperty('error');
    expect(parseBalanceAdjustment('abc')).toHaveProperty('error');
    expect(parseBalanceAdjustment('100000001')).toHaveProperty('error');
  });

  it('formats signed coin movements', () => {
    expect(formatSignedCoins(1500)).toBe('+1.500');
    expect(formatSignedCoins(-20)).toBe('−20');
  });
});
