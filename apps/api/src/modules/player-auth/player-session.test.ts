import { describe, expect, it } from 'vitest';

import { createPlayerSession, readPlayerSession } from './player-session.js';

describe('player session', () => {
  it('rejects modified or expired session cookies', () => {
    const secret = 'session-secret';
    const session = {
      avatarUrl: null,
      balance: 200,
      expiresAt: Date.now() + 60_000,
      id: 'discord-user',
      name: 'FutHubber',
    };
    const cookie = createPlayerSession(session, secret);

    expect(readPlayerSession(cookie, secret)).toEqual(session);
    expect(readPlayerSession(`${cookie}x`, secret)).toBeNull();
    expect(
      readPlayerSession(createPlayerSession({ ...session, expiresAt: 0 }, secret), secret),
    ).toBeNull();
  });
});
