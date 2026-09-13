import { useEffect, useState } from 'react';

import { Dashboard, type PlayerSession } from './dashboard';

type SessionState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'guest' }>
  | Readonly<{ kind: 'player'; session: PlayerSession }>;

export function App() {
  const [state, setState] = useState<SessionState>({ kind: 'loading' });

  useEffect(() => {
    void loadSession().then(setState);
  }, []);

  if (state.kind === 'loading') return <main className="loading-screen">Carregando FutHub…</main>;
  if (state.kind === 'guest') return <Login />;
  return (
    <Dashboard
      onLogout={() => void logout().then(() => setState({ kind: 'guest' }))}
      session={state.session}
    />
  );
}

function Login() {
  return (
    <main className="login-shell">
      <section className="login-copy" aria-labelledby="login-title">
        <a className="brand" href="/" aria-label="FutHub, início">
          <span aria-hidden="true" className="brand-ball" />
          FutHub
        </a>
        <div>
          <p className="kicker">SEU CLUBE. SUA HISTÓRIA.</p>
          <h1 id="login-title">
            Monte elenco.
            <br />
            Domine liga.
          </h1>
          <p className="lead">
            Cards, mercado e partidas competitivas. Tudo começa com seu perfil Discord.
          </p>
          <a className="discord-button" href="/v1/auth/player/discord">
            <DiscordMark />
            Entrar com Discord
          </a>
        </div>
        <p className="login-note">Login seguro. Nenhuma senha FutHub necessária.</p>
      </section>
      <aside className="pitch" aria-label="Campo tático FutHub">
        <div className="pitch-glow" />
        <div className="pitch-lines" />
        <div className="pitch-copy">
          <span>PRÓXIMA TEMPORADA</span>
          <strong>
            COMEÇA
            <br />
            AGORA
          </strong>
        </div>
        <div className="formation" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </aside>
    </main>
  );
}

function DiscordMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M19.5 5.4A16 16 0 0 0 15.5 4l-.5 1a15 15 0 0 0-6 0l-.5-1a16 16 0 0 0-4 1.4C2 9.2 1.4 12.8 1.7 16.3A16 16 0 0 0 6.6 18.8l1.2-1.6a10 10 0 0 1-1.9-.9l.5-.4c3.7 1.7 7.6 1.7 11.2 0l.5.4c-.6.4-1.2.7-1.9.9l1.2 1.6a16 16 0 0 0 4.9-2.5c.4-4.1-.6-7.6-2.8-10.9ZM8.6 14.1c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.8 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  );
}

async function loadSession(): Promise<SessionState> {
  const response = await fetch('/v1/auth/player/session');
  if (!response.ok) return { kind: 'guest' };
  const data: unknown = await response.json();
  return isPlayerSession(data) ? { kind: 'player', session: data } : { kind: 'guest' };
}

async function logout(): Promise<void> {
  await fetch('/v1/auth/player/session', { method: 'DELETE' });
}

function isPlayerSession(value: unknown): value is PlayerSession {
  if (!isRecord(value)) return false;
  const session = value;
  return (
    typeof session.id === 'string' &&
    typeof session.name === 'string' &&
    (typeof session.avatarUrl === 'string' || session.avatarUrl === null) &&
    typeof session.balance === 'number'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
