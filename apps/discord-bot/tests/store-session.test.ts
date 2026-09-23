import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type StorePacks,
  type StoreSessionState,
  createStoreSessionManager,
} from '../src/modules/store/session.js';

const MINUTE = 60_000;
const packsState = (): StorePacks => ({ tab: 'packs', page: 1, favoritePackIds: [] });

function fakeRuntime(secret = 'test-secret') {
  let now = 1_000_000;
  let sequence = 0;
  return {
    advance(milliseconds: number) {
      now += milliseconds;
    },
    manager: createStoreSessionManager({
      clock: () => now,
      randomBytes: (size) => {
        const bytes = new Uint8Array(size);
        bytes[0] = sequence & 0xff;
        bytes[1] = (sequence >>> 8) & 0xff;
        sequence += 1;
        return bytes;
      },
      secret,
    }),
  };
}

function contratarState(cardId = '00000000-0000-4000-8000-000000000001'): StoreSessionState {
  return {
    tab: 'contratar',
    filters: {
      positions: [],
      minOverall: 60,
      maxOverall: 100,
      teamId: null,
      collectionId: null,
      sort: 'recent',
    },
    page: 1,
    total: 1,
    totalPages: 1,
    catalog: { teams: [], collections: [] },
    items: [
      {
        id: cardId,
        name: 'Carta Teste',
        imageUrl: 'https://example.com/card.png',
        overall: 90,
        position: 'CA',
        secondaryPositions: ['PD'],
        defense: 10,
        attack: 90,
        creation: 80,
        passing: 70,
        control: 85,
        marking: 12,
        pace: 88,
        dribbling: 87,
        finishing: 91,
        price: 500,
        team: { id: 'team-1', name: 'Time', emoji: 'T' },
        collection: { id: 'collection-1', name: 'Coleção', emoji: 'C' },
      },
    ],
    selection: { kind: 'none' },
    pickerPage: 0,
    purchase: { kind: 'idle' },
  };
}

test('isolates multiple sliding sessions for the same owner', () => {
  const runtime = fakeRuntime();
  const first = runtime.manager.create('owner-1', packsState());
  const second = runtime.manager.create('owner-1', contratarState());

  assert.notEqual(first.id.value, second.id.value);
  runtime.advance(14 * MINUTE);
  const renewed = runtime.manager.get(first.id, 'owner-1');
  assert.equal(renewed.kind, 'owned');
  assert.equal(renewed.kind === 'owned' ? renewed.session.expiresAt : 0, 1_000_000 + 29 * MINUTE);

  runtime.advance(2 * MINUTE);
  assert.equal(runtime.manager.get(second.id, 'owner-1').kind, 'expired');
  assert.equal(runtime.manager.get(first.id, 'owner-1').kind, 'owned');
});

test('signs and parses owner-bound custom IDs below Discord limit', () => {
  const runtime = fakeRuntime();
  const session = runtime.manager.create('owner-1', contratarState());
  const customId = runtime.manager.sign(session.id, {
    action: 'select',
    arg: '00000000-0000-4000-8000-000000000001',
  });

  assert.ok(customId.length < 100);
  const parsed = runtime.manager.parse(customId, 'owner-1');
  assert.equal(parsed.kind, 'owned');
  if (parsed.kind === 'owned') {
    assert.equal(parsed.action.action, 'select');
    assert.equal(parsed.action.arg, '00000000-0000-4000-8000-000000000001');
    assert.equal(parsed.session.ownerId, 'owner-1');
  }
});

test('rejects stale compare-and-swap state transitions', () => {
  const runtime = fakeRuntime();
  const session = runtime.manager.create('owner-1', packsState());
  const firstState = { ...session.state, page: 2 };
  const first = runtime.manager.replaceStateIf(session.id, 'owner-1', session.state, firstState);
  assert.equal(first.kind, 'owned');

  const stale = runtime.manager.replaceStateIf(session.id, 'owner-1', session.state, {
    ...session.state,
    page: 3,
  });
  assert.equal(stale.kind, 'stale');
  if (stale.kind === 'stale') assert.equal(stale.session.state.page, 2);
});

test('rejects tampering, malformed versions, actions, arguments, and owners without renewal', () => {
  const runtime = fakeRuntime();
  const session = runtime.manager.create('owner-1', packsState());
  const valid = runtime.manager.sign(session.id, { action: 'tab', arg: 'contratar' });
  const tampered = `${valid.slice(0, -1)}${valid.endsWith('a') ? 'b' : 'a'}`;

  runtime.advance(10 * MINUTE);
  assert.equal(runtime.manager.parse(tampered, 'owner-1').kind, 'invalid');
  assert.equal(runtime.manager.parse(valid.replace('ls1:', 'ls2:'), 'owner-1').kind, 'invalid');
  assert.equal(
    runtime.manager.parse(valid.replace(session.id.value, 'short'), 'owner-1').kind,
    'invalid',
  );
  assert.equal(runtime.manager.parse(valid.replace(':tab:', ':hack:'), 'owner-1').kind, 'invalid');
  assert.equal(
    runtime.manager.parse(valid.replace(':contratar:', ':bad arg:'), 'owner-1').kind,
    'invalid',
  );
  assert.equal(runtime.manager.parse(valid, 'owner-2').kind, 'foreign');

  runtime.advance(6 * MINUTE);
  assert.equal(runtime.manager.parse(valid, 'owner-1').kind, 'expired');
});

test('does not clean expired sessions for a foreign signed action', () => {
  const runtime = fakeRuntime();
  runtime.manager.create('owner-2', packsState());
  runtime.advance(MINUTE);
  const owned = runtime.manager.create('owner-1', packsState());
  const customId = runtime.manager.sign(owned.id, { action: 'tab', arg: 'contratar' });
  runtime.advance(14 * MINUTE);

  assert.equal(runtime.manager.size, 2);
  assert.equal(runtime.manager.parse(customId, 'owner-2').kind, 'foreign');
  assert.equal(runtime.manager.size, 2);
});

test('invalidates custom IDs after a process-secret restart', () => {
  const before = fakeRuntime('before-restart');
  const session = before.manager.create('owner-1', packsState());
  const customId = before.manager.sign(session.id, { action: 'tab', arg: 'packs' });
  const after = fakeRuntime('after-restart');

  assert.equal(after.manager.parse(customId, 'owner-1').kind, 'invalid');
});

test('lazily removes expired sessions before evicting the least recently used session', () => {
  const runtime = fakeRuntime();
  const expired = runtime.manager.create('owner-1', packsState());
  runtime.advance(15 * MINUTE);
  const survivors = Array.from({ length: 1_000 }, () =>
    runtime.manager.create('owner-1', packsState()),
  );

  assert.equal(runtime.manager.size, 1_000);
  assert.equal(runtime.manager.get(expired.id, 'owner-1').kind, 'expired');

  const oldest = survivors[0];
  const newest = survivors.at(-1);
  assert.ok(oldest && newest);
  runtime.manager.create('owner-1', packsState());
  assert.equal(runtime.manager.size, 1_000);
  assert.equal(runtime.manager.get(oldest.id, 'owner-1').kind, 'expired');
  assert.equal(runtime.manager.get(newest.id, 'owner-1').kind, 'owned');
});
