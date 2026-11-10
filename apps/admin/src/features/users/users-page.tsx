import { type AdminUserPage, getV1AdminUsers } from '@futhub/api-client';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApiOptions } from '../../api/admin-client';
import { AdminIcon } from '../../components/admin-icon';
import './users.css';
import { adminErrorMessage, formatCoins, formatDate } from './user-format';

const pageSize = 25;

export function UserAvatar({ name, url }: Readonly<{ name: string; url: string | null }>) {
  return url ? (
    <img alt="" className="user-avatar" src={url} />
  ) : (
    <span aria-hidden="true" className="user-avatar user-avatar--initial">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('busca') ?? '';
  const page = Math.max(1, Number(params.get('pagina')) || 1);
  const [draft, setDraft] = useState(query);
  const [result, setResult] = useState<AdminUserPage | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter deliberately restarts this GET.
  useEffect(() => {
    let active = true;
    setError('');
    void getV1AdminUsers({ query: query || undefined, page, pageSize }, adminApiOptions())
      .then((loaded) => {
        if (active) setResult(loaded);
      })
      .catch((cause) => {
        if (active) setError(adminErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [query, page, retry]);

  function search(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    setParams(next ? { busca: next } : {});
  }

  function goTo(nextPage: number) {
    setParams({ ...(query ? { busca: query } : {}), pagina: String(nextPage) });
  }

  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <section className="users-page" aria-labelledby="users-title">
      <header className="command-header">
        <div>
          <p className="eyebrow">Operação / Jogadores</p>
          <h1 className="page-title" id="users-title">
            <AdminIcon className="page-title-icon" name="players" />
            <span>Usuários</span>
          </h1>
          <p>
            Encontre um jogador pelo nome ou ID do Discord para ajustar saldo, progressão, cards,
            packs, campos e acesso ao bot.
          </p>
        </div>
      </header>

      <form className="users-toolbar" onSubmit={search}>
        <label className="users-field">
          <span className="sr-only">Buscar usuário</span>
          <input
            autoComplete="off"
            placeholder="Nome, ID do Discord ou ID interno"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <button className="ops-button secondary" type="submit">
          Buscar
        </button>
        {result ? (
          <output>
            {result.total} {result.total === 1 ? 'usuário' : 'usuários'}
          </output>
        ) : null}
      </form>

      {error ? (
        <div role="alert">
          <p className="form-error">{error}</p>
          <button
            className="ops-button"
            onClick={() => setRetry((value) => value + 1)}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : !result ? (
        <output>Carregando usuários…</output>
      ) : result.items.length ? (
        <>
          <ul className="users-list">
            {result.items.map((user) => (
              <li key={user.id}>
                <Link className="users-row" to={`/app/usuarios/${user.id}`}>
                  <UserAvatar name={user.name} url={user.avatarUrl} />
                  <span className="users-row-identity">
                    <strong>{user.name}</strong>
                    <code>{user.discordUserId}</code>
                  </span>
                  <span className="users-row-badges">
                    {user.banned ? (
                      <span className="user-badge user-badge--banned">Banido</span>
                    ) : null}
                    {user.booster ? <span className="user-badge">Booster</span> : null}
                  </span>
                  <dl className="users-row-facts">
                    <div>
                      <dt>Saldo</dt>
                      <dd>{formatCoins(user.balance)}</dd>
                    </div>
                    <div>
                      <dt>Nível</dt>
                      <dd>{user.level}</dd>
                    </div>
                    <div>
                      <dt>Cards</dt>
                      <dd>{user.cardCount}</dd>
                    </div>
                    <div>
                      <dt>Atividade</dt>
                      <dd>{formatDate(user.updatedAt)}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <nav className="ops-pagination" aria-label="Paginação">
              <button disabled={page <= 1} onClick={() => goTo(page - 1)} type="button">
                Anterior
              </button>
              <span>
                Página {result.page} de {pages}
              </span>
              <button disabled={page >= pages} onClick={() => goTo(page + 1)} type="button">
                Próxima
              </button>
            </nav>
          ) : null}
        </>
      ) : (
        <p className="users-empty">
          {query
            ? 'Nenhum usuário encontrado para esta busca.'
            : 'Nenhum jogador usou o bot ainda. Usuários aparecem aqui após o primeiro comando.'}
        </p>
      )}
    </section>
  );
}
