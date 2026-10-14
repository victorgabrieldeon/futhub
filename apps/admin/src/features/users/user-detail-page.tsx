import {
  type AdminUserDetail,
  type AdminUserOptions,
  deleteV1AdminUsersIdCardsUserCardId,
  deleteV1AdminUsersIdFieldsFieldId,
  getV1AdminUsersId,
  getV1AdminUsersOptions,
  postV1AdminUsersIdBalance,
  postV1AdminUsersIdCards,
  putV1AdminUsersId,
  putV1AdminUsersIdFieldsFieldId,
  putV1AdminUsersIdPacksPackId,
} from '@futhub/api-client';
import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { adminApiOptions } from '../../api/admin-client';
import './users.css';
import {
  adminErrorMessage,
  claimOriginLabels,
  formatCoins,
  formatDate,
  formatSignedCoins,
  parseBalanceAdjustment,
  transactionLabels,
} from './user-format';
import { UserAvatar } from './users-page';

type Resource = Readonly<{ id: string; name: string }>;
type Saved = (user: AdminUserDetail) => void;
type Tab = 'geral' | 'cards' | 'packs' | 'campos' | 'historico';

const resourceLimit = 200;
const tabs: readonly Tab[] = ['geral', 'cards', 'packs', 'campos', 'historico'];

function isTab(value: string | null): value is Tab {
  return tabs.includes(value as Tab);
}

function tabLabel(tab: Tab, user: AdminUserDetail): string {
  if (tab === 'geral') return 'Info geral';
  if (tab === 'cards') return `Cards (${user.cardCount})`;
  if (tab === 'packs')
    return `Packs (${user.packs.reduce((total, pack) => total + pack.quantity, 0)})`;
  if (tab === 'campos') return `Campos (${user.fields.length})`;
  return 'Histórico';
}

function UserTabs({
  active,
  user,
  onChange,
}: Readonly<{ active: Tab; user: AdminUserDetail; onChange: (tab: Tab) => void }>) {
  function move(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.indexOf(active);
    const next =
      event.key === 'ArrowRight'
        ? tabs[(index + 1) % tabs.length]
        : event.key === 'ArrowLeft'
          ? tabs[(index - 1 + tabs.length) % tabs.length]
          : event.key === 'Home'
            ? tabs[0]
            : event.key === 'End'
              ? tabs[tabs.length - 1]
              : undefined;
    if (!next) return;
    event.preventDefault();
    onChange(next);
    document.getElementById(`user-tab-${next}`)?.focus();
  }

  return (
    <div
      aria-label="Seções do usuário"
      className="command-tabs users-tabs"
      onKeyDown={move}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          aria-controls={`user-panel-${tab}`}
          aria-selected={active === tab}
          className="command-tab"
          id={`user-tab-${tab}`}
          key={tab}
          onClick={() => onChange(tab)}
          role="tab"
          tabIndex={active === tab ? 0 : -1}
          type="button"
        >
          {tabLabel(tab, user)}
        </button>
      ))}
    </div>
  );
}

function useAction(onSaved: Saved) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function run(action: () => Promise<AdminUserDetail>): Promise<boolean> {
    setPending(true);
    setError('');
    try {
      onSaved(await action());
      return true;
    } catch (cause) {
      setError(adminErrorMessage(cause));
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, error, setError, run };
}

function ActionError({ error }: Readonly<{ error: string }>) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}

function ResourcePicker({
  label,
  resources,
  value,
  onChange,
}: Readonly<{
  label: string;
  resources: readonly Resource[];
  value: string;
  onChange: (id: string) => void;
}>) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const matches = resources.filter(
    (resource) =>
      resource.id === value || resource.name.toLocaleLowerCase('pt-BR').includes(normalized),
  );
  return (
    <>
      {resources.length > 20 ? (
        <label className="users-field">
          Buscar {label.toLowerCase()}
          <input
            placeholder="Digite parte do nome"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      ) : null}
      <label className="users-field">
        {label}
        <select required value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Escolha…</option>
          {matches.slice(0, resourceLimit).map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.name}
            </option>
          ))}
        </select>
        {matches.length > resourceLimit ? (
          <small>
            Mostrando {resourceLimit} de {matches.length}. Refine a busca.
          </small>
        ) : resources.length === 0 ? (
          <small>Nada disponível para conceder.</small>
        ) : null}
      </label>
    </>
  );
}

function BalancePanel({ user, onSaved }: Readonly<{ user: AdminUserDetail; onSaved: Saved }>) {
  const [value, setValue] = useState('');
  const { pending, error, setError, run } = useAction(onSaved);
  const parsed = value.trim() ? parseBalanceAdjustment(value) : null;
  const preview = parsed && 'amount' in parsed ? user.balance + parsed.amount : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = parseBalanceAdjustment(value);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    if (await run(() => postV1AdminUsersIdBalance(user.id, result, adminApiOptions())))
      setValue('');
  }

  return (
    <form className="users-panel" aria-busy={pending} onSubmit={(event) => void submit(event)}>
      <div className="users-panel-heading">
        <h2>Saldo</h2>
        <p>
          Ajustes somam ou subtraem do saldo atual de forma atômica e ficam registrados no histórico
          como “Ajuste do admin”.
        </p>
      </div>
      <p className="users-balance">{formatCoins(user.balance)}</p>
      <fieldset className="users-fieldset" disabled={pending}>
        <label className="users-field">
          Ajuste
          <input
            autoComplete="off"
            inputMode="numeric"
            placeholder="500 ou -200"
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <small>
            {preview === null
              ? 'Use sinal de menos para debitar.'
              : preview < 0
                ? 'O saldo não pode ficar negativo.'
                : `Novo saldo: ${formatCoins(preview)}`}
          </small>
        </label>
      </fieldset>
      <ActionError error={error} />
      <div className="users-actions">
        <button className="ops-button accent" disabled={pending} type="submit">
          {pending ? 'Aplicando…' : 'Aplicar ajuste'}
        </button>
      </div>
    </form>
  );
}

function ProfilePanel({ user, onSaved }: Readonly<{ user: AdminUserDetail; onSaved: Saved }>) {
  const [level, setLevel] = useState(String(user.level));
  const [xp, setXp] = useState(String(user.xp));
  const [booster, setBooster] = useState(user.booster);
  const [banned, setBanned] = useState(user.banned);
  const { pending, error, run } = useAction(onSaved);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      banned &&
      !user.banned &&
      !window.confirm(`Banir ${user.name}? O bot passará a recusar todos os comandos dele.`)
    )
      return;
    await run(() =>
      putV1AdminUsersId(
        user.id,
        { level: Number(level), xp: Number(xp), booster, banned },
        adminApiOptions(),
      ),
    );
  }

  return (
    <form className="users-panel" aria-busy={pending} onSubmit={(event) => void submit(event)}>
      <div className="users-panel-heading">
        <h2>Progressão e acesso</h2>
        <p>
          Nível {user.level} pede {user.nextLevelXp} XP para subir. Alterar o nível aqui não concede
          as recompensas de nível.
        </p>
      </div>
      <fieldset className="users-fieldset" disabled={pending}>
        <label className="users-field">
          Nível
          <input
            inputMode="numeric"
            max={1000}
            min={1}
            required
            type="number"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          />
        </label>
        <label className="users-field">
          XP no nível
          <input
            inputMode="numeric"
            min={0}
            required
            type="number"
            value={xp}
            onChange={(event) => setXp(event.target.value)}
          />
        </label>
        <label className="users-toggle">
          <input
            checked={booster}
            type="checkbox"
            onChange={(event) => setBooster(event.target.checked)}
          />
          Booster do servidor
        </label>
        <label className="users-toggle users-toggle--danger">
          <input
            checked={banned}
            type="checkbox"
            onChange={(event) => setBanned(event.target.checked)}
          />
          Banido
        </label>
      </fieldset>
      <ActionError error={error} />
      <div className="users-actions">
        <button className="ops-button accent" disabled={pending} type="submit">
          {pending ? 'Salvando…' : 'Salvar perfil'}
        </button>
      </div>
    </form>
  );
}

function CardsPanel({
  user,
  options,
  onSaved,
}: Readonly<{ user: AdminUserDetail; options: AdminUserOptions; onSaved: Saved }>) {
  const [cardId, setCardId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [filter, setFilter] = useState('');
  const { pending, error, run } = useAction(onSaved);
  const free = user.maxCards - user.cardCount;
  const normalized = filter.trim().toLocaleLowerCase('pt-BR');
  const visible = user.cards.filter((card) =>
    `${card.name} ${card.position}`.toLocaleLowerCase('pt-BR').includes(normalized),
  );

  async function add(event: FormEvent) {
    event.preventDefault();
    if (
      await run(() =>
        postV1AdminUsersIdCards(user.id, { cardId, quantity: Number(quantity) }, adminApiOptions()),
      )
    )
      setQuantity('1');
  }

  function remove(card: AdminUserDetail['cards'][number]) {
    const lineup = card.holder ? ' Ele está escalado como titular.' : '';
    if (!window.confirm(`Remover ${card.name} (${card.overall}) do inventário?${lineup}`)) return;
    void run(() => deleteV1AdminUsersIdCardsUserCardId(user.id, card.id, adminApiOptions()));
  }

  return (
    <section className="users-panel users-panel--wide" aria-busy={pending}>
      <div className="users-panel-heading">
        <h2>
          Cards <span>{user.cardCount}</span> / {user.maxCards}
        </h2>
        <p>Cards concedidos aqui aparecem com origem “Admin”.</p>
      </div>
      <form className="users-fieldset" onSubmit={(event) => void add(event)}>
        <ResourcePicker
          label="Card"
          resources={options.cards}
          value={cardId}
          onChange={setCardId}
        />
        <label className="users-field">
          Quantidade
          <input
            inputMode="numeric"
            max={Math.max(1, Math.min(100, free))}
            min={1}
            required
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <small>{free > 0 ? `${free} vagas livres.` : 'Inventário cheio.'}</small>
        </label>
        <div className="users-actions users-actions--inline">
          <button className="ops-button accent" disabled={pending || free <= 0} type="submit">
            Conceder card
          </button>
        </div>
      </form>
      <ActionError error={error} />
      {user.cards.length > 10 ? (
        <label className="users-field users-filter">
          <span className="sr-only">Filtrar cards do usuário</span>
          <input
            placeholder="Filtrar por nome ou posição"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
      ) : null}
      {visible.length ? (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th scope="col">Card</th>
                <th scope="col">OVR</th>
                <th scope="col">Posição</th>
                <th scope="col">Situação</th>
                <th scope="col">Origem</th>
                <th scope="col">Recebido</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((card) => (
                <tr key={card.id}>
                  <th scope="row">{card.name}</th>
                  <td>{card.overall}</td>
                  <td>{card.position}</td>
                  <td>
                    {[
                      card.holder ? 'Titular' : null,
                      card.captain ? 'Capitão' : null,
                      card.favorite ? 'Favorito' : null,
                      card.inTrade ? 'Em troca' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td>{claimOriginLabels[card.claimedBy] ?? card.claimedBy}</td>
                  <td>{formatDate(card.claimedAt)}</td>
                  <td>
                    <button
                      aria-label={`Remover ${card.name}`}
                      className="ops-button danger"
                      disabled={pending || card.inTrade}
                      onClick={() => remove(card)}
                      title={
                        card.inTrade
                          ? 'Cards que participaram de trocas não podem ser removidos.'
                          : undefined
                      }
                      type="button"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="users-empty">
          {user.cards.length ? 'Nenhum card encontrado para este filtro.' : 'Nenhum card.'}
        </p>
      )}
    </section>
  );
}

function PackRow({
  userId,
  pack,
  onSaved,
}: Readonly<{ userId: string; pack: AdminUserDetail['packs'][number]; onSaved: Saved }>) {
  const [quantity, setQuantity] = useState(String(pack.quantity));
  const { pending, error, run } = useAction(onSaved);
  const save = (next: number) =>
    void run(() =>
      putV1AdminUsersIdPacksPackId(userId, pack.packId, { quantity: next }, adminApiOptions()),
    );

  return (
    <li className="users-item" aria-busy={pending}>
      <strong>{pack.name}</strong>
      <form
        className="users-item-actions"
        onSubmit={(event) => {
          event.preventDefault();
          save(Number(quantity));
        }}
      >
        <label className="users-field users-field--compact">
          <span className="sr-only">Quantidade de {pack.name}</span>
          <input
            inputMode="numeric"
            min={0}
            required
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <button
          className="ops-button secondary"
          disabled={pending || Number(quantity) === pack.quantity}
          type="submit"
        >
          Salvar
        </button>
        <button
          aria-label={`Remover ${pack.name}`}
          className="ops-button danger"
          disabled={pending}
          onClick={() => save(0)}
          type="button"
        >
          Remover
        </button>
      </form>
      <ActionError error={error} />
    </li>
  );
}

function PacksPanel({
  user,
  options,
  onSaved,
}: Readonly<{ user: AdminUserDetail; options: AdminUserOptions; onSaved: Saved }>) {
  const [packId, setPackId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const { pending, error, run } = useAction(onSaved);
  const owned = user.packs.find((pack) => pack.packId === packId)?.quantity ?? 0;

  async function add(event: FormEvent) {
    event.preventDefault();
    const total = owned + Number(quantity);
    if (
      await run(() =>
        putV1AdminUsersIdPacksPackId(user.id, packId, { quantity: total }, adminApiOptions()),
      )
    )
      setQuantity('1');
  }

  return (
    <section className="users-panel" aria-busy={pending}>
      <div className="users-panel-heading">
        <h2>Packs fechados</h2>
        <p>Packs no inventário, prontos para abrir com /abrir-pack.</p>
      </div>
      <form className="users-fieldset" onSubmit={(event) => void add(event)}>
        <ResourcePicker
          label="Pack"
          resources={options.packs}
          value={packId}
          onChange={setPackId}
        />
        <label className="users-field">
          Adicionar
          <input
            inputMode="numeric"
            min={1}
            required
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          {owned ? <small>Já possui {owned}.</small> : null}
        </label>
        <div className="users-actions users-actions--inline">
          <button className="ops-button accent" disabled={pending} type="submit">
            Conceder pack
          </button>
        </div>
      </form>
      <ActionError error={error} />
      {user.packs.length ? (
        <ul className="users-items">
          {user.packs.map((pack) => (
            <PackRow
              key={`${pack.packId}:${pack.quantity}`}
              onSaved={onSaved}
              pack={pack}
              userId={user.id}
            />
          ))}
        </ul>
      ) : (
        <p className="users-empty">Nenhum pack fechado.</p>
      )}
    </section>
  );
}

function FieldsPanel({
  user,
  options,
  onSaved,
}: Readonly<{ user: AdminUserDetail; options: AdminUserOptions; onSaved: Saved }>) {
  const [fieldId, setFieldId] = useState('');
  const { pending, error, run } = useAction(onSaved);
  const owned = new Set(user.fields.map((field) => field.fieldId));
  const available = options.fields.filter((field) => !owned.has(field.id));

  async function grant(event: FormEvent) {
    event.preventDefault();
    if (await run(() => putV1AdminUsersIdFieldsFieldId(user.id, fieldId, adminApiOptions())))
      setFieldId('');
  }

  function revoke(field: AdminUserDetail['fields'][number]) {
    if (!window.confirm(`Remover o campo ${field.name}?`)) return;
    void run(() => deleteV1AdminUsersIdFieldsFieldId(user.id, field.fieldId, adminApiOptions()));
  }

  return (
    <section className="users-panel" aria-busy={pending}>
      <div className="users-panel-heading">
        <h2>Campos</h2>
        <p>Cada campo é concedido uma única vez.</p>
      </div>
      <form className="users-fieldset" onSubmit={(event) => void grant(event)}>
        <ResourcePicker label="Campo" resources={available} value={fieldId} onChange={setFieldId} />
        <div className="users-actions users-actions--inline">
          <button
            className="ops-button accent"
            disabled={pending || !available.length}
            type="submit"
          >
            Conceder campo
          </button>
        </div>
      </form>
      <ActionError error={error} />
      {user.fields.length ? (
        <ul className="users-items">
          {user.fields.map((field) => (
            <li className="users-item" key={field.fieldId}>
              <strong>{field.name}</strong>
              <div className="users-item-actions">
                <button
                  aria-label={`Remover ${field.name}`}
                  className="ops-button danger"
                  disabled={pending}
                  onClick={() => revoke(field)}
                  type="button"
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="users-empty">Nenhum campo.</p>
      )}
    </section>
  );
}

function TransactionsPanel({ user }: Readonly<{ user: AdminUserDetail }>) {
  return (
    <section className="users-panel users-panel--wide">
      <div className="users-panel-heading">
        <h2>Histórico de saldo</h2>
        <p>Últimas {user.transactions.length} movimentações registradas.</p>
      </div>
      {user.transactions.length ? (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th scope="col">Quando</th>
                <th scope="col">Tipo</th>
                <th scope="col">Valor</th>
              </tr>
            </thead>
            <tbody>
              {user.transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{formatDate(transaction.createdAt)}</td>
                  <td>{transactionLabels[transaction.type] ?? transaction.type}</td>
                  <td className="users-amount">{formatSignedCoins(transaction.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="users-empty">Nenhuma movimentação registrada.</p>
      )}
    </section>
  );
}

export function UserDetailPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('aba');
  const tab: Tab = isTab(requestedTab) ? requestedTab : 'geral';
  const selectTab = (next: Tab) =>
    setParams(next === 'geral' ? {} : { aba: next }, { replace: true });
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [options, setOptions] = useState<AdminUserOptions | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter deliberately restarts these GETs.
  useEffect(() => {
    let active = true;
    setError('');
    void Promise.all([
      getV1AdminUsersId(id, adminApiOptions()),
      getV1AdminUsersOptions(adminApiOptions()),
    ])
      .then(([loadedUser, loadedOptions]) => {
        if (!active) return;
        setUser(loadedUser);
        setOptions(loadedOptions);
      })
      .catch((cause) => {
        if (active) setError(adminErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [id, retry]);

  return (
    <section className="users-page" aria-labelledby="user-title">
      <Link className="users-back" to="/app/usuarios">
        ← Usuários
      </Link>
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
      ) : !user || !options ? (
        <output>Carregando usuário…</output>
      ) : (
        <>
          <header className="users-hero">
            <UserAvatar name={user.name} url={user.avatarUrl} />
            <div>
              <p className="eyebrow">Operação / Usuários</p>
              <h1 className="page-title" id="user-title">
                {user.name}
              </h1>
              <p className="users-hero-ids">
                Discord <code>{user.discordUserId}</code> · ID <code>{user.id}</code>
              </p>
              <p className="users-row-badges">
                {user.banned ? <span className="user-badge user-badge--banned">Banido</span> : null}
                {user.booster ? <span className="user-badge">Booster</span> : null}
              </p>
            </div>
            <dl className="users-hero-facts">
              <div>
                <dt>Nível</dt>
                <dd>
                  {user.level} · {user.xp}/{user.nextLevelXp} XP
                </dd>
              </div>
              <div>
                <dt>Estádio</dt>
                <dd>{user.stadiumLevel === null ? 'Sem clube' : `Nível ${user.stadiumLevel}`}</dd>
              </div>
              <div>
                <dt>Idioma</dt>
                <dd>{user.language}</dd>
              </div>
              <div>
                <dt>Desde</dt>
                <dd>{formatDate(user.createdAt)}</dd>
              </div>
            </dl>
          </header>
          <UserTabs active={tab} onChange={selectTab} user={user} />
          <div
            aria-labelledby={`user-tab-${tab}`}
            className={tab === 'geral' ? 'users-grid' : 'users-tabpanel'}
            id={`user-panel-${tab}`}
            role="tabpanel"
          >
            {/* Keys reset each form's local draft whenever the server state changes. */}
            {tab === 'geral' ? (
              <>
                <BalancePanel key={`balance:${user.balance}`} onSaved={setUser} user={user} />
                <ProfilePanel
                  key={`profile:${user.level}:${user.xp}:${user.booster}:${user.banned}`}
                  onSaved={setUser}
                  user={user}
                />
              </>
            ) : tab === 'cards' ? (
              <CardsPanel onSaved={setUser} options={options} user={user} />
            ) : tab === 'packs' ? (
              <PacksPanel onSaved={setUser} options={options} user={user} />
            ) : tab === 'campos' ? (
              <FieldsPanel onSaved={setUser} options={options} user={user} />
            ) : (
              <TransactionsPanel user={user} />
            )}
          </div>
        </>
      )}
    </section>
  );
}
