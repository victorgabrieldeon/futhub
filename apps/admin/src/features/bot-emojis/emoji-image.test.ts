import { expect, it } from 'vitest';
import { fitWithin, mayLoseAnimation, needsResize } from './emoji-image';

const file = (type: string, size: number) => new File([new Uint8Array(size)], 'x', { type });

it('fits images inside 128px without upscaling or distorting', () => {
  expect(fitWithin(1024, 1024)).toEqual([128, 128]);
  expect(fitWithin(2000, 500)).toEqual([128, 32]);
  expect(fitWithin(300, 1200)).toEqual([32, 128]);
  expect(fitWithin(64, 40)).toEqual([64, 40]);
  expect(fitWithin(5000, 1)).toEqual([128, 1]);
});

it('only re-encodes files Discord would reject', () => {
  expect(needsResize(file('image/png', 256 * 1024))).toBe(false);
  expect(needsResize(file('image/gif', 1000))).toBe(false);
  expect(needsResize(file('image/png', 256 * 1024 + 1))).toBe(true);
  expect(needsResize(file('image/svg+xml', 100))).toBe(true);
  expect(needsResize(file('image/avif', 100))).toBe(true);
  expect(mayLoseAnimation(file('image/gif', 1))).toBe(true);
  expect(mayLoseAnimation(file('image/jpeg', 1))).toBe(false);
});
