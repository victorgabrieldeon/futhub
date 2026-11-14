import { ApiClientError } from '@futhub/api-client';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import type { Identity } from './session';

export type ScreenProps = Readonly<{
  me: Identity;
  notify: (notice: Notice) => void;
  onBalance: (balance: number) => void;
}>;

export type Notice = Readonly<{ kind: 'ok' | 'error'; text: string }>;

type MissionNotice = Readonly<{ title: string }>;

const customEmoji = /^<(a?):\w+:(\d+)>$/;

/** Entidades podem ter emoji da aplicação Discord (`<:nome:id>`); vira imagem do CDN. */
export function Emoji({ value }: Readonly<{ value: string }>) {
  const match = customEmoji.exec(value);
  if (!match) return <>{value}</>;
  const extension = match[1] ? 'gif' : 'png';
  return (
    <img
      alt=""
      className="emoji"
      src={`https://cdn.discordapp.com/emojis/${match[2]}.${extension}`}
    />
  );
}

/** `<option>` só aceita texto: emoji customizado some. */
export const emojiText = (value: string) => (customEmoji.test(value) ? '' : value);

export const coins = (value: number) => `◉ ${value.toLocaleString('pt-BR')}`;

export function errorText(error: unknown): string {
  if (error instanceof ApiClientError) {
    const detail = error.message.split(': ').slice(1).join(': ');
    if (detail) return detail;
    if (error.status === 401) return 'Sessão expirada. Entre novamente.';
    if (error.status === 404) return 'Não encontrado ou indisponível.';
    return 'Operação recusada. Confira saldo e inventário.';
  }
  return error instanceof Error ? error.message : 'Algo deu errado.';
}

/** Mensagem de sucesso com missões concluídas pela ação, igual ao bot. */
export function withMissions(text: string, missions: readonly MissionNotice[] = []): string {
  if (!missions.length) return text;
  return `${text} Missão concluída: ${missions.map(({ title }) => title).join(', ')}.`;
}

export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    setError(null);
    return load().then(setData, (cause: unknown) => setError(errorText(cause)));
  }, [load]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, reload };
}

/** Executa ação com estado de carregamento e aviso de erro padronizado. */
export function useAction(notify: ScreenProps['notify']) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      try {
        await action();
      } catch (error) {
        notify({ kind: 'error', text: errorText(error) });
      } finally {
        setBusy(false);
      }
    },
    [busy, notify],
  );
  return { busy, run };
}

export function Loadable<T>({
  children,
  state,
}: Readonly<{
  children: (data: T) => ReactNode;
  state: { data: T | null; error: string | null; reload: () => Promise<void> };
}>) {
  if (state.error)
    return (
      <div className="panel empty">
        <p>{state.error}</p>
        <button className="ghost-button" onClick={() => void state.reload()} type="button">
          Tentar de novo
        </button>
      </div>
    );
  if (state.data === null) return <div className="panel empty">Carregando…</div>;
  return <>{children(state.data)}</>;
}

export function ScreenHeader({
  kicker,
  title,
  children,
}: Readonly<{ kicker: string; title: string; children?: ReactNode }>) {
  return (
    <header className="screen-header">
      <div>
        <p className="kicker">{kicker}</p>
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}

export type CardView = Readonly<{
  imageUrl: string | null;
  name: string;
  overall: number;
  position: string;
  team?: Readonly<{ emoji: string; name: string }>;
}>;

export function PlayerCard({
  card,
  children,
  selected,
  onSelect,
}: Readonly<{
  card: CardView;
  children?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
}>) {
  const body = (
    <>
      <span className="card-overall">{card.overall}</span>
      <span className="card-position">{card.position}</span>
      {card.imageUrl ? (
        <img alt="" className="card-photo" loading="lazy" src={card.imageUrl} />
      ) : (
        <span aria-hidden="true" className="card-photo card-photo-empty" />
      )}
      <strong className="card-name">{card.name}</strong>
      {card.team ? (
        <span className="card-team">
          <Emoji value={card.team.emoji} /> {card.team.name}
        </span>
      ) : null}
    </>
  );
  return (
    <article className={`player-card${selected ? ' is-selected' : ''}`}>
      {onSelect ? (
        <button aria-pressed={selected} className="card-hit" onClick={onSelect} type="button">
          {body}
        </button>
      ) : (
        body
      )}
      {children ? <div className="card-actions">{children}</div> : null}
    </article>
  );
}

export function Pager({
  page,
  totalPages,
  onPage,
}: Readonly<{ page: number; totalPages: number; onPage: (page: number) => void }>) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="pager">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} type="button">
        ← Anterior
      </button>
      <span>
        {page} / {totalPages}
      </span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} type="button">
        Próxima →
      </button>
    </nav>
  );
}
