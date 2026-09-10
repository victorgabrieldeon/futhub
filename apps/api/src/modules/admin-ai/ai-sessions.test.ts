import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AiSession, AiSessions, flushAiResults } from './ai-sessions.js';

const connection = {
  provider: 'openai',
  baseUrl: 'https://api.example.net/v1',
  apiKey: 'test-secret',
} as const;
const idleLimit = 30 * 60_000;
let now: number;
let sessions: AiSessions;

beforeEach(() => {
  now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  sessions = new AiSessions();
});
afterEach(() => {
  sessions.onModuleDestroy();
  vi.restoreAllMocks();
});

describe('AiSessions', () => {
  it.each(['get', 'remove'] as const)('returns 404 for foreign ownership on %s', (method) => {
    const session = sessions.create('owner', connection);
    expect(() => sessions[method]('other', session.state.id)).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
    expect(sessions.get('owner', session.state.id)).toBe(session);
  });

  it('returns 404 for unknown session IDs', () => {
    expect(() => sessions.get('owner', 'missing')).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
  });

  it('keeps foreign ownership hidden even when session is busy', () => {
    const session = sessions.create('owner', connection);
    session.busy = true;
    expect(() => sessions.get('other', session.state.id)).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
  });

  it('blocks concurrent runs and access with 409 without expiring an active operation', async () => {
    const session = sessions.create('owner', connection);
    let release: (() => void) | undefined;
    const active = sessions.run(
      session,
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const competing = vi.fn(async () => undefined);
    try {
      now += idleLimit + 1;
      for (const method of ['get', 'remove'] as const) {
        expect(() => sessions[method]('owner', session.state.id)).toThrowError(
          expect.objectContaining({ status: 409 }),
        );
      }
      await expect(sessions.run(session, competing)).rejects.toMatchObject({ status: 409 });
      expect(competing).not.toHaveBeenCalled();
    } finally {
      release?.();
      await active;
    }
    expect(session.busy).toBe(false);
    expect(session.touchedAt).toBe(now);
    expect(sessions.get('owner', session.state.id)).toBe(session);
  });

  it('releases busy state and refreshes activity when operation rejects', async () => {
    const session = sessions.create('owner', connection);
    const failure = new Error('operation failed');
    await expect(
      sessions.run(session, async () => {
        now += 1000;
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(session.busy).toBe(false);
    expect(session.touchedAt).toBe(now);
    expect(sessions.get('owner', session.state.id)).toBe(session);
  });

  it.each([idleLimit - 1, idleLimit])(
    'keeps session accessible at %i idle milliseconds',
    (elapsed) => {
      const session = sessions.create('owner', connection);
      now += elapsed;
      expect(sessions.get('owner', session.state.id)).toBe(session);
    },
  );

  it('returns 404 beyond 30 idle minutes', () => {
    const session = sessions.create('owner', connection);
    now += idleLimit + 1;
    expect(() => sessions.get('owner', session.state.id)).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
  });

  it('extends idle expiry after owner access', () => {
    const session = sessions.create('owner', connection);
    now += idleLimit - 1;
    sessions.get('owner', session.state.id);
    now += idleLimit - 1;
    expect(sessions.get('owner', session.state.id)).toBe(session);
  });

  it('does not extend expiry after foreign access', () => {
    const session = sessions.create('owner', connection);
    now += idleLimit - 1;
    expect(() => sessions.get('other', session.state.id)).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
    now += 2;
    expect(() => sessions.get('owner', session.state.id)).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
  });

  it('allows 100 sessions and rejects the 101st with 503', () => {
    for (let index = 0; index < 100; index++) sessions.create('owner', connection);
    expect(() => sessions.create('other', connection)).toThrowError(
      expect.objectContaining({ status: 503 }),
    );
  });

  it('reclaims expired capacity before creating another session', () => {
    for (let index = 0; index < 100; index++) sessions.create('owner', connection);
    now += idleLimit + 1;
    expect(sessions.create('owner', connection)).toMatchObject({ owner: 'owner', touchedAt: now });
  });

  it('removes disconnected sessions without affecting another session', () => {
    const removed = sessions.create('owner', connection);
    const retained = sessions.create('owner', connection);
    sessions.remove('owner', removed.state.id);
    expect(() => sessions.get('owner', removed.state.id)).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
    expect(sessions.get('owner', retained.state.id)).toBe(retained);
  });

  it('cancels cleanup interval and clears all sessions on module destruction', () => {
    const first = sessions.create('owner', connection);
    const second = sessions.create('other', connection);
    const clearInterval = vi.spyOn(globalThis, 'clearInterval');
    sessions.onModuleDestroy();
    expect(clearInterval).toHaveBeenCalledOnce();
    for (const session of [first, second]) {
      expect(() => sessions.get(session.owner, session.state.id)).toThrowError(
        expect.objectContaining({ status: 404 }),
      );
    }
  });
});

describe('flushAiResults', () => {
  let session: AiSession;
  beforeEach(() => {
    session = sessions.create('owner', connection);
    session.round = [
      { id: 'first', name: 'search_teams', arguments: '{}' },
      { id: 'second', name: 'search_cards', arguments: '{}' },
    ];
  });

  it('waits for every call without consuming partial results', () => {
    session.results.set('second', 'cards');
    expect(flushAiResults(session)).toBe(false);
    expect(session.transcript).toEqual([]);
    expect(session.state.messages).toEqual([]);
    expect(session.round.map((call) => call.id)).toEqual(['first', 'second']);
    expect([...session.results]).toEqual([['second', 'cards']]);
  });

  it('flushes in call order rather than response arrival order, then clears the round', () => {
    session.results.set('second', 'cards');
    session.results.set('first', 'teams');
    expect(flushAiResults(session)).toBe(true);
    expect(session.transcript).toEqual([
      { role: 'tool', toolCallId: 'first', content: 'teams' },
      { role: 'tool', toolCallId: 'second', content: 'cards' },
    ]);
    expect(session.state.messages.map(({ role, content }) => ({ role, content }))).toEqual([
      { role: 'tool', content: 'teams' },
      { role: 'tool', content: 'cards' },
    ]);
    expect(session.round).toEqual([]);
    expect(session.results.size).toBe(0);
  });

  it('counts an empty string as a received result', () => {
    session.results.set('first', '');
    session.results.set('second', 'cards');
    expect(flushAiResults(session)).toBe(true);
    expect(session.transcript[0]).toEqual({ role: 'tool', toolCallId: 'first', content: '' });
  });

  it('does not duplicate results when a completed round is flushed again', () => {
    session.results.set('first', 'teams');
    session.results.set('second', 'cards');
    flushAiResults(session);
    const transcript = structuredClone(session.transcript);
    expect(flushAiResults(session)).toBe(true);
    expect(session.transcript).toEqual(transcript);
    expect(session.state.messages).toHaveLength(2);
  });
});
