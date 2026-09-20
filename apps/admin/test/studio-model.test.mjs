import assert from 'node:assert/strict';
import { cardFrames } from '../src/features/studio/card-design.ts';
import {
  defaultLayerOrder,
  emptyDraft,
  inspectDraft,
  moveLayer,
  parseStoredDraft,
  playerImageSpecification,
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
assert.equal(emptyDraft.design?.frame, 'crest');
const { design: _design, ...legacyDraft } = emptyDraft;
assert.deepEqual(parseStoredDraft(legacyDraft)?.design, emptyDraft.design);
assert.equal(
  parseStoredDraft({ ...emptyDraft, design: { ...emptyDraft.design, frame: 'invalid' } }),
  null,
);
assert.equal(
  parseStoredDraft({ ...emptyDraft, design: { ...emptyDraft.design, textureOpacity: 101 } }),
  null,
);
assert.equal(
  parseStoredDraft({ ...emptyDraft, design: { ...emptyDraft.design, metalColor: 'url(unsafe)' } }),
  null,
);
assert.deepEqual(
  cardFrames.map((frame) => frame.id),
  ['crest', 'arena', 'ticket', 'diamond', 'hexagon', 'crown', 'wing', 'pavilion'],
);
for (const frame of cardFrames) {
  assert.equal(
    parseStoredDraft({ ...emptyDraft, design: { ...emptyDraft.design, frame: frame.id } })?.design
      .frame,
    frame.id,
  );
}
const customDesign = {
  ...emptyDraft.design,
  frame: 'ticket',
  texture: 'rays',
  nameScale: 85,
  edition: 'FUNDADORES 2026',
  showStatBars: false,
};
assert.deepEqual(parseStoredDraft({ ...emptyDraft, design: customDesign })?.design, customDesign);
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
assert.deepEqual(playerImageSpecification, { height: 1200, mimeType: 'image/png', width: 1200 });

const emptyHealth = inspectDraft(emptyDraft);
assert.equal(emptyHealth.find((check) => check.id === 'photo')?.status, 'blocked');
assert.equal(emptyHealth.find((check) => check.id === 'stats')?.status, 'ready');

const unstandardizedPhoto = inspectDraft({
  ...emptyDraft,
  photoFormat: 'png',
  playerImageUrl: 'https://example.test/player.png',
});
assert.equal(unstandardizedPhoto.find((check) => check.id === 'photo')?.status, 'blocked');
const standardPhoto = inspectDraft({
  ...emptyDraft,
  photoFormat: 'png',
  photoIsStandard: true,
  playerImageUrl: 'https://example.test/player.png',
});
assert.equal(standardPhoto.find((check) => check.id === 'photo')?.status, 'ready');

console.log('studio-model: ok');
