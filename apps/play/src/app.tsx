import { getClub } from '@futhub/api-client';
import { useCallback, useEffect, useState } from 'react';

import { Home } from './screens/home';
import { League } from './screens/league';
import { Market } from './screens/market';
import { Missions } from './screens/missions';
import { Store } from './screens/store';
import { Team } from './screens/team';
import { type PlayerSession, identityOf, isActivity, loadSession, logout } from './session';
import { type Notice, type ScreenProps, coins, errorText } from './ui';

type SessionState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'guest' }>
  | Readonly<{ kind: 'error'; message: string }>
  | Readonly<{ kind: 'player'; session: PlayerSession }>;

const screens = {
  inicio: { label: 'Início', Screen: Home },
  loja: { label: 'Loja', Screen: Store },
  elenco: { label: 'Elenco', Screen: Team },
  mercado: { label: 'Mercado', Screen: Market },
  liga: { label: 'Liga', Screen: League },
  missoes: { label: 'Missões', Screen: Missions },
} as const;
type ScreenId = keyof typeof screens;

export function App() {
  const [state, setState] = useState<SessionState>({ kind: 'loading' });
  const start = useCallback(() => {
    setState({ kind: 'loading' });
    loadSession().then(
      (session) => setState(session ? { kind: 'player', session } : { kind: 'guest' }),
      (error: unknown) => setState({ kind: 'error', message: errorText(error) }),
    );
  }, []);
  useEffect(start, []);

  if (state.kind === 'loading') return <main className="loading-screen">Carregando FutHub…</main>;
  if (state.kind === 'error')
    return (
      <main className="loading-screen">
        <p>{state.message}</p>
        <button className="play-button" onClick={start} type="button">
          Tentar de novo
        </button>
      </main>
    );
  if (state.kind === 'guest') return <Login />;
  return (
    <Game
      onLogout={() => void logout().then(() => setState({ kind: 'guest' }))}
      session={state.session}
    />
  );
}

function Game({ onLogout, session }: Readonly<{ onLogout: () => void; session: PlayerSession }>) {
  const [screen, setScreen] = useState<ScreenId>(() => {
    const hash = window.location.hash.slice(1);
    return hash in screens ? (hash as ScreenId) : 'inicio';
  });
  const [balance, setBalance] = useState(session.balance);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [me] = useState(() => identityOf(session));
  const notify = useCallback((next: Notice) => setNotice(next), []);
  // Saldo da sessão é foto do login; o clube traz o valor atual.
  useEffect(() => {
    getClub(me).then(
      ({ balance: current }) => setBalance(current),
      () => undefined,
    );
  }, [me]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const { Screen } = screens[screen];
  const props: ScreenProps = { me, notify, onBalance: setBalance };
  const initials = session.name.slice(0, 2).toUpperCase();
  return (
    <main className="app-shell">
      <header className="app-nav">
        <span className="brand">
          <span aria-hidden="true" className="brand-ball" />
          FutHub
        </span>
        <nav aria-label="Navegação principal">
          {(Object.keys(screens) as ScreenId[]).map((id) => (
            <a
              aria-current={id === screen ? 'page' : undefined}
              className={id === screen ? 'is-active' : undefined}
              href={`#${id}`}
              key={id}
              onClick={() => setScreen(id)}
            >
              {screens[id].label}
            </a>
          ))}
        </nav>
        <div className="player-menu">
          <span className="coins">{coins(balance)}</span>
          {session.avatarUrl ? (
            <img alt="" className="avatar" height="40" src={session.avatarUrl} width="40" />
          ) : (
            <span className="avatar avatar-fallback">{initials}</span>
          )}
          {isActivity ? null : (
            <button onClick={onLogout} type="button">
              Sair
            </button>
          )}
        </div>
      </header>
      <div className="screen">
        <Screen key={screen} {...props} />
      </div>
      {notice ? (
        <div
          className={`toast toast-${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          {notice.text}
          <button aria-label="Fechar aviso" onClick={() => setNotice(null)} type="button">
            ×
          </button>
        </div>
      ) : null}
    </main>
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
