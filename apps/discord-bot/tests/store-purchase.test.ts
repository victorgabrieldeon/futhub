import assert from 'node:assert/strict';
import test from 'node:test';

import { purchaseSelectedCard } from '../src/modules/store/purchase.js';
import { initialHiringState, storeSessionManager } from '../src/modules/store/state.js';

test('reserva a contratação antes do ACK e libera a reserva se o ACK falhar', async () => {
  const identity = { id: '900000000000000005', name: 'Jogador', avatarUrl: null };
  const cardId = '00000000-0000-4000-8000-000000000001';
  const session = storeSessionManager.create(identity.id, {
    ...initialHiringState(),
    selection: { kind: 'selected', cardId },
  });
  let rejectAck!: (error: Error) => void;
  const ack = new Promise<void>((_, reject) => {
    rejectAck = reject;
  });

  const first = purchaseSelectedCard(session.id, identity, cardId, () => ack);
  const second = await purchaseSelectedCard(session.id, identity, cardId, () => {
    throw new Error('Duplicate interaction should not be acknowledged.');
  });
  assert.deepEqual(second, {
    kind: 'immediate',
    message: 'Esta contratação já está sendo processada.',
  });

  rejectAck(new Error('Discord ACK failed'));
  await assert.rejects(first, /Discord ACK failed/);
  const access = storeSessionManager.get(session.id, identity.id);
  assert.equal(access.kind, 'owned');
  if (access.kind === 'owned' && access.session.state.tab === 'contratar')
    assert.equal(access.session.state.purchase.kind, 'idle');
});
