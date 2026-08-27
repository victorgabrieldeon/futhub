import assert from 'node:assert/strict';
import {
  defaultLayerOrder,
  emptyDraft,
  inspectDraft,
  moveLayer,
  parseStoredDraft,
  statsForPosition,
  studioAssetDefinitions,
  studioAssetSize,
  stylePresets,
} from '../src/features/studio/studio-model.ts';

const striker = statsForPosition('CA', 90);
assert.equal(striker.finishing, 97);
assert.equal(striker.marking, 78);
assert.equal(statsForPosition('PD', 99).pace, 100);

const raisedPhoto = moveLayer(defaultLayerOrder, 'photo', 1);
assert.deepEqual(raisedPhoto.slice(2, 4), ['rating', 'photo']);
assert.equal(moveLayer(defaultLayerOrder, 'background', -1), defaultLayerOrder);

assert.equal(parseStoredDraft(emptyDraft)?.name, emptyDraft.name);
assert.equal(stylePresets[0]?.id, 'elite-aqua');
assert.equal(stylePresets[0]?.style, 'elite');
assert.equal(parseStoredDraft({ name: 'inválido' }), null);
const restoredLegacyDraft = parseStoredDraft({
  ...emptyDraft,
  collectionOverlayUrl: 'https://example.com/legacy-overlay.png',
});
assert.ok(restoredLegacyDraft);
assert.equal('collectionOverlayUrl' in restoredLegacyDraft, false);

assert.deepEqual(
  studioAssetDefinitions.map((asset) => asset.id),
  ['ea-fc-item', 'futgg-item', 'simple-card', 'social-image', 'share-image', 'player-image'],
);
assert.deepEqual(studioAssetSize('social-image'), { width: 1200, height: 630 });
assert.deepEqual(studioAssetSize('share-image', 2160), { width: 2160, height: 2160 });
assert.deepEqual(studioAssetSize('ea-fc-item', 100), { width: 300, height: 400 });

const emptyHealth = inspectDraft(emptyDraft);
assert.equal(emptyHealth.find((check) => check.id === 'photo')?.status, 'blocked');
assert.equal(emptyHealth.find((check) => check.id === 'stats')?.status, 'ready');

console.log('studio-model: ok');
