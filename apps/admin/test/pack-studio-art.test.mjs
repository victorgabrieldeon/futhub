import assert from 'node:assert/strict';
import { packArtStyleKey, packArtSvg } from '../src/features/studio/pack-art.ts';
import {
  defaultPackStudioDraft,
  packStudioArtKeys,
  packStudioPresets,
} from '../src/features/studio/pack-studio-model.ts';

// Given an existing composition, when text color changes, then render key changes.
const draft = defaultPackStudioDraft();
assert.notEqual(packArtStyleKey(draft), packArtStyleKey({ ...draft, textColor: '#112233' }));
for (const { art } of packStudioPresets) {
  assert.deepEqual(Object.keys(art).sort(), [...packStudioArtKeys].sort());
  const applied = { ...draft, name: 'Custom', price: 123, headline: 'CUSTOM', ...art };
  assert.equal(applied.name, 'Custom');
  assert.equal(applied.price, 123);
  assert.equal(applied.headline, 'CUSTOM');
}
const fallback = packArtSvg({ ...draft, headline: '<script>&', kicker: 'A & B' });
assert.ok(fallback.includes('&lt;SCRIPT&gt;&amp;'));
assert.ok(fallback.includes('A &amp; B'));
console.log('pack-studio-art: ok');
