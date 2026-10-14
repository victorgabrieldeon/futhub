import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';

import { emojiAssetsDir, renderEmoji } from '../src/core/emoji-sync.js';
import { EMOJI, EMOJI_FALLBACK, EMOJI_NAMES, registerEmojis } from '../src/core/emojis.js';

test('every emoji name has exactly one SVG asset', async () => {
  const assets = (await readdir(emojiAssetsDir))
    .filter((file) => file.endsWith('.svg'))
    .map((file) => file.slice(0, -4))
    .sort();
  assert.deepEqual(assets, [...EMOJI_NAMES].sort());
});

test('emoji assets render as PNGs within the Discord limit', async () => {
  for (const name of EMOJI_NAMES) {
    const png = await renderEmoji(name);
    assert.ok(png.subarray(1, 4).toString('latin1') === 'PNG', name);
    assert.ok(png.length < 256 * 1024, name);
  }
});

test('emojis fall back to unicode until registered with the application', () => {
  assert.equal(EMOJI.moeda, EMOJI_FALLBACK.moeda);
  registerEmojis([
    { id: '1558537977867800706', name: 'moeda' },
    { id: '1558537977867800707', name: 'outro' },
  ]);
  assert.equal(EMOJI.moeda, '<:moeda:1558537977867800706>');
  assert.equal(EMOJI.sucesso, EMOJI_FALLBACK.sucesso);
});
