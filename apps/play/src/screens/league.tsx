import {
  type SimulateTestMatchBodyDifficulty,
  getLeague,
  getMatch,
  getRankedStatus,
  joinRankedQueue,
  simulateTestMatch,
} from '@futhub/api-client';
import { useCallback, useEffect, useState } from 'react';

import {
  Emoji,
  Loadable,
  ScreenHeader,
  type ScreenProps,
  errorText,
  useAction,
  useLoad,
} from '../ui';

type Replay = Readonly<{
  away: string;
  awayGoals: number;
  events: readonly Readonly<{
    awayGoals: number;
    description: string;
    homeGoals: number;
    minute: number;
    type: string;
  }>[];
  home: string;
  homeGoals: number;
}>;

const difficulties = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' } as const;
const eventIcons: Record<string, string> = {
  fulltime: '🏁',
  goal: '⚽',
  kickoff: '▶',
  red_card: '🟥',
  yellow_card: '🟨',
};
const pollMs = 3_000;
const eventMs = 700;

export function League({ me, notify }: ScreenProps) {
  const league = useLoad(useCallback(() => getLeague(me), [me]));
  const { busy, run } = useAction(notify);
  const [waiting, setWaiting] = useState(false);
  const [difficulty, setDifficulty] = useState<SimulateTestMatchBodyDifficulty>('medium');
  const [replay, setReplay] = useState<Replay | null>(null);

  const showMatch = useCallback(
    async (matchId: string) => {
      const match = await getMatch(matchId);
      setWaiting(false);
      setReplay({ ...match, away: match.away.name, home: match.home.name });
      void league.reload();
    },
    [league.reload],
  );

  // Fila ranqueada: o pareamento acontece no servidor; aqui só acompanhamos o status.
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      getRankedStatus(me.id).then(
        (status) => {
          if (status?.kind === 'matched') void showMatch(status.matchId);
          else if (status === null) setWaiting(false);
        },
        (error: unknown) => {
          setWaiting(false);
          notify({ kind: 'error', text: errorText(error) });
        },
      );
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [me.id, notify, showMatch, waiting]);

  const queue = () =>
    run(async () => {
      const result = await joinRankedQueue(me);
      if (result.kind === 'matched') await showMatch(result.matchId);
      else setWaiting(true);
    });

  const testMatch = () =>
    run(async () => {
      const match = await simulateTestMatch({ difficulty, identity: me });
      setReplay({ ...match, away: match.away.name, home: match.home.name });
    });

  return (
    <>
      <ScreenHeader kicker="LIGA" title="Partidas" />
      <section className="dashboard-grid">
        <Loadable state={league}>
          {(data) => (
            <article className="rank-card">
              <div>
                <p className="kicker">SUA DIVISÃO</p>
                <h2>
                  <Emoji value={data.division.emoji} /> {data.division.name}
                </h2>
                <p>
                  {data.points} pts · {data.wins}V {data.draws}E {data.losses}D
                </p>
              </div>
              {data.division.imageUrl ? (
                <img alt="" className="rank-emblem" src={data.division.imageUrl} />
              ) : null}
            </article>
          )}
        </Loadable>
        <article className="match-card">
          <p className="kicker">RANQUEADA</p>
          <h2>{waiting ? 'Procurando adversário…' : 'Pronto para jogar?'}</h2>
          <p>Enfrente outro clube da sua divisão. Vitória vale pontos na liga.</p>
          <button
            className="play-button"
            disabled={busy || waiting}
            onClick={() => void queue()}
            type="button"
          >
            {waiting ? 'Na fila' : 'Entrar na fila'} <span>→</span>
          </button>
        </article>
        <article className="stat-card">
          <p>AMISTOSO VS CPU</p>
          <strong>Teste</strong>
          <select
            aria-label="Dificuldade"
            onChange={(event) =>
              setDifficulty(event.target.value as SimulateTestMatchBodyDifficulty)
            }
            value={difficulty}
          >
            {Object.entries(difficulties).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            className="ghost-button"
            disabled={busy}
            onClick={() => void testMatch()}
            type="button"
          >
            Jogar amistoso
          </button>
        </article>
      </section>
      {replay ? <MatchReplay onClose={() => setReplay(null)} replay={replay} /> : null}
    </>
  );
}

function MatchReplay({ onClose, replay }: Readonly<{ onClose: () => void; replay: Replay }>) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(reduced ? replay.events.length : 1);
  useEffect(() => {
    setShown(reduced ? replay.events.length : 1);
    if (reduced) return;
    const timer = window.setInterval(
      () => setShown((count) => Math.min(replay.events.length, count + 1)),
      eventMs,
    );
    return () => window.clearInterval(timer);
  }, [reduced, replay]);
  const last = replay.events[shown - 1];
  const done = shown >= replay.events.length;
  return (
    <section aria-live="polite" className="panel match-replay">
      <header className="scoreboard">
        <strong>{replay.home}</strong>
        <span>
          {done ? replay.homeGoals : (last?.homeGoals ?? 0)} ×{' '}
          {done ? replay.awayGoals : (last?.awayGoals ?? 0)}
        </span>
        <strong>{replay.away}</strong>
      </header>
      <ol className="event-list">
        {replay.events.slice(0, shown).map((event, index) => (
          <li className={`event-${event.type}`} key={`${event.minute}-${index}`}>
            <span className="event-minute">{event.minute}'</span>
            <span aria-hidden="true">{eventIcons[event.type] ?? '•'}</span>
            <span>{event.description}</span>
          </li>
        ))}
      </ol>
      <div className="toolbar">
        {done ? null : (
          <button
            className="ghost-button"
            onClick={() => setShown(replay.events.length)}
            type="button"
          >
            Pular
          </button>
        )}
        <button className="ghost-button" onClick={onClose} type="button">
          Fechar
        </button>
      </div>
    </section>
  );
}
