import assert from 'node:assert/strict';
import {
  defaultPackStudioDraft,
  packStudioDraft,
  packStudioInput,
} from '../src/features/studio/pack-studio-model.ts';
import {
  packStudioProjectFileName,
  packStudioProjectJson,
  parsePackStudioProjectJson,
} from '../src/features/studio/pack-studio-project.ts';

const draft = { ...defaultPackStudioDraft(), name: 'Champions 2026' };
const result = parsePackStudioProjectJson(packStudioProjectJson(draft));

assert.equal(result.kind, 'success');
if (result.kind === 'success') {
  assert.deepEqual(result.draft, draft);
}
assert.equal(packStudioProjectFileName(draft), 'champions-2026.futhub');
assert.equal(parsePackStudioProjectJson('{').kind, 'invalid');
assert.equal(
  parsePackStudioProjectJson('{"version":1,"kind":"futhub-pack","pack":{}}').kind,
  'invalid',
);

const presentation = {
  schemaVersion: 1,
  color: '#101112',
  accentColor: '#f2bd54',
  textColor: '#ffffff',
  effect: 'chrome',
  texture: 'lightning',
  textureOpacity: 55,
  tintOpacity: 22,
  headline: 'EDIÇÃO HISTÓRICA',
  headlineSize: 62,
  headlineX: 280,
  headlineY: 290,
  kicker: 'FINAL DE TEMPORADA',
  kickerX: 280,
  kickerY: 210,
};
const persistedPack = {
  id: 'pack-id',
  name: 'Champions 2026',
  imageUrl: null,
  color: '#082a60',
  emoji: 'pack',
  cardsAmount: 4,
  price: 30,
  canBuy: true,
  limitPerUser: 8,
  presentation,
  config: {
    id: 'config-id',
    name: null,
    minOverall: 0,
    maxOverall: 99,
    onlyPositions: [],
    excludedPositions: [],
    onlyCollectionIds: [],
    excludedCollectionIds: [],
    onlyCardIds: [],
    excludedCardIds: [],
    onlyTeamIds: [],
    excludedTeamIds: [],
  },
};
const reopenedDraft = packStudioDraft(persistedPack);

assert.equal(reopenedDraft.color, presentation.color);
assert.equal(reopenedDraft.headline, presentation.headline);
assert.deepEqual(packStudioInput(reopenedDraft, persistedPack).presentation, presentation);

console.log('pack-studio-project: ok');
