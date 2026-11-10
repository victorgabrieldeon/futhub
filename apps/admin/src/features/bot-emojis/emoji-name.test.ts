import { expect, it } from 'vitest';
import { emojiNameFromFile } from './emoji-name';

it('suggests Discord-safe emoji names from file names', () => {
  expect(emojiNameFromFile('Moeda Dourada.png')).toBe('moeda_dourada');
  expect(emojiNameFromFile('troféu-ouro (2).gif')).toBe('trofeu_ouro_2');
  expect(emojiNameFromFile(`${'a'.repeat(40)}.webp`)).toBe('a'.repeat(32));
  expect(emojiNameFromFile('x.png')).toBe('');
  expect(emojiNameFromFile('---.png')).toBe('');
});
