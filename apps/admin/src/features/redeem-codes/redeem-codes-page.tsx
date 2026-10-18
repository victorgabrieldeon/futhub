import {
  type AdminRedeemCode,
  type AdminRedeemCodeOptions,
  ApiClientError,
  deleteV1AdminRedeemCodesId,
  getV1AdminRedeemCodes,
  getV1AdminRedeemCodesOptions,
  postV1AdminRedeemCodes,
  putV1AdminRedeemCodesId,
} from '@futhub/api-client';
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { adminApiOptions } from '../../api/admin-client';
import { AdminIcon } from '../../components/admin-icon';
import './redeem-codes.css';
import {
  type RedeemCodeDraft,
  type RedeemCodeStatus,
  type RewardType,
  canonicalCode,
  claimsShare,
  draftFrom,
  emptyDraft,
  expiryAfter,
  expiryLabel,
  generateCode,
  inputFrom,
  matchesQuery,
  redeemCodeStatus,
  rewardLabel,
  rewardTypeLabels,
} from './redeem-code-form';

const statusLabels: Record<RedeemCodeStatus, string> = {
  active: 'Ativo',
  inactive: 'Desativado',
  expired: 'Expirado',
  exhausted: 'Esgotado',
};
const statusOrder: readonly RedeemCodeStatus[] = ['active', 'inactive', 'expired', 'exhausted'];
type StatusFilter = RedeemCodeStatus | 'all';
const expiryShortcuts: readonly [string, number][] = [
  ['24 h', 24],
  ['7 dias', 24 * 7],
  ['30 dias', 24 * 30],
];
const resourceLimit = 200;

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiClientError && cause.status === 401) window.location.assign('/login');
  if (cause instanceof ApiClientError)
    return cause.message.replace(/^FutHub API request failed with status \d+: /, '');
  return 'Não foi possível concluir a solicitação.';
}

function byNewest(codes: AdminRedeemCode[]): AdminRedeemCode[] {
  return [...codes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function resourcesFor(options: AdminRedeemCodeOptions, type: RewardType) {
  if (type === 'card') return options.cards;
  if (type === 'pack') return options.packs;
  if (type === 'field') return options.fields;
  return [];
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <button
      aria-label={`Copiar ${text}`}
      className="redeem-copy"
      data-state={state}
      onClick={() =>
        void navigator.clipboard.writeText(text).then(
          () => setState('copied'),
          () => setState('failed'),
        )
      }
      type="button"
    >
      <span aria-live="polite">
        {state === 'copied' ? 'Copiado' : state === 'failed' ? 'Falhou' : 'Copiar'}
      </span>
    </button>
  );
}

/** One sentence with what a player gets and under which conditions. */
function draftSummary(draft: RedeemCodeDraft, resourceName: string | undefined, now: Date) {
  const amount = Number(draft.amount);
  const validAmount = Number.isSafeInteger(amount) && amount > 0;
  const reward =
    draft.rewardType === 'balance'
      ? validAmount
        ? rewardLabel({ type: 'balance', amount, resourceId: null, resourceName: null, itemId: '' })
        : 'moedas'
      : resourceName
        ? rewardLabel({
            type: draft.rewardType,
            amount: validAmount ? amount : 1,
            resourceId: draft.resourceId,
            resourceName,
            itemId: '',
          })
        : `${rewardTypeLabels[draft.rewardType].toLowerCase()} (escolha qual)`;
  const limit = draft.maxClaims.trim() ? `até ${draft.maxClaims} resgates` : 'resgates ilimitados';
  const expiry = draft.expiresAt
    ? expiryLabel(new Date(draft.expiresAt).toISOString(), now).replace(/^em /, 'expira em ')
    : 'sem expiração';
  return { code: draft.code || '…', reward, conditions: `${limit} · ${expiry}` };
}

function RedeemCodeForm({
  editing,
  options,
  onSaved,
  onCancel,
}: {
  editing: AdminRedeemCode | null;
  options: AdminRedeemCodeOptions;
  onSaved: (code: AdminRedeemCode) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<RedeemCodeDraft>(editing ? draftFrom(editing) : emptyDraft);
  const [resourceQuery, setResourceQuery] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const codeId = useId();
  const locked = editing?.locked ?? false;
  const now = new Date();
  const set = (patch: Partial<RedeemCodeDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const resources = resourcesFor(options, draft.rewardType);
  const normalizedQuery = resourceQuery.trim().toLocaleLowerCase('pt-BR');
  const matches = resources.filter(
    (resource) =>
      resource.id === draft.resourceId ||
      resource.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
  );
  const visibleResources = matches.slice(0, resourceLimit);
  const resourceName = resources.find((resource) => resource.id === draft.resourceId)?.name;
  const summary = draftSummary(draft, resourceName, now);
  const expiryInvalid = Boolean(draft.expiresAt) && new Date(draft.expiresAt) <= now;

  // biome-ignore lint/correctness/useExhaustiveDependencies: The form remounts per edited code.
  useEffect(() => {
    if (!editing) return;
    headingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  function cancelOnEscape(event: KeyboardEvent) {
    if (editing && event.key === 'Escape' && !pending) onCancel();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = inputFrom(draft);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setPending(true);
    setError('');
    try {
      onSaved(
        editing
          ? await putV1AdminRedeemCodesId(editing.id, result.input, adminApiOptions())
          : await postV1AdminRedeemCodes(result.input, adminApiOptions()),
      );
      if (!editing) setDraft(emptyDraft);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-busy={pending}
      aria-labelledby="redeem-form-title"
      className={editing ? 'redeem-form redeem-form--editing' : 'redeem-form'}
      onKeyDown={cancelOnEscape}
      onSubmit={(event) => void submit(event)}
    >
      <div className="redeem-form-heading">
        <h2 id="redeem-form-title" ref={headingRef} tabIndex={-1}>
          {editing ? `Editar ${editing.code}` : 'Novo código de resgate'}
        </h2>
        {locked ? (
          <p>
            Já resgatado {editing?.claims} vez(es): código e recompensa ficam fixos para preservar o
            histórico. Limite, expiração e status continuam editáveis.
          </p>
        ) : (
          <p>O jogador digita o código em /resgatar e recebe o Item uma única vez.</p>
        )}
      </div>

      <fieldset className="redeem-fieldset" disabled={pending || locked}>
        <legend>Código e recompensa</legend>
        <div className="redeem-field redeem-field--code">
          <label htmlFor={codeId}>Código</label>
          <div className="redeem-code-input">
            <input
              aria-describedby={`${codeId}-hint`}
              autoComplete="off"
              id={codeId}
              maxLength={32}
              placeholder="BEMVINDO"
              required
              spellCheck={false}
              value={draft.code}
              onChange={(event) => set({ code: canonicalCode(event.target.value) })}
            />
            <button
              className="ops-button secondary"
              onClick={() => set({ code: generateCode() })}
              title="Sugere um código aleatório fácil de digitar"
              type="button"
            >
              Gerar
            </button>
          </div>
          <small id={`${codeId}-hint`}>
            {draft.code.length}/32 · letras, números, hífen ou sublinhado. Maiúsculas automáticas.
          </small>
        </div>
        <label className="redeem-field">
          Recompensa
          <select
            value={draft.rewardType}
            onChange={(event) => {
              set({ rewardType: event.target.value as RewardType, resourceId: '', amount: '1' });
              setResourceQuery('');
            }}
          >
            {Object.entries(rewardTypeLabels).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="redeem-field">
          Quantidade
          <input
            disabled={draft.rewardType === 'field'}
            inputMode="numeric"
            min={1}
            max={draft.rewardType === 'field' ? 1 : undefined}
            required
            type="number"
            value={draft.amount}
            onChange={(event) => set({ amount: event.target.value })}
          />
          {draft.rewardType === 'field' ? (
            <small>Campos são concedidos uma única vez.</small>
          ) : draft.rewardType === 'balance' ? (
            <small>Creditadas direto no saldo do jogador.</small>
          ) : null}
        </label>
        {draft.rewardType !== 'balance' ? (
          <div className="redeem-resource">
            {resources.length > 20 ? (
              <label className="redeem-field">
                Buscar {rewardTypeLabels[draft.rewardType].toLowerCase()}
                <input
                  placeholder="Digite parte do nome"
                  type="search"
                  value={resourceQuery}
                  onChange={(event) => setResourceQuery(event.target.value)}
                />
              </label>
            ) : null}
            <label className="redeem-field">
              {rewardTypeLabels[draft.rewardType]} concedido
              <select
                required
                value={draft.resourceId}
                onChange={(event) => set({ resourceId: event.target.value })}
              >
                <option value="">Escolha…</option>
                {visibleResources.map((resource) => (
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
                <small>Nenhum item deste tipo cadastrado.</small>
              ) : null}
            </label>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="redeem-fieldset" disabled={pending}>
        <legend>Condições de uso</legend>
        <label className="redeem-field">
          Limite de resgates
          <input
            inputMode="numeric"
            min={Math.max(1, editing?.claims ?? 1)}
            placeholder="Ilimitado"
            type="number"
            value={draft.maxClaims}
            onChange={(event) => set({ maxClaims: event.target.value })}
          />
          <small>Total entre todos os jogadores. Vazio = sem limite.</small>
        </label>
        <div className="redeem-field">
          <label className="redeem-field">
            Expira em
            <input
              aria-invalid={expiryInvalid || undefined}
              type="datetime-local"
              value={draft.expiresAt}
              onChange={(event) => set({ expiresAt: event.target.value })}
            />
          </label>
          <fieldset className="redeem-presets">
            <legend className="sr-only">Atalhos de expiração</legend>
            {expiryShortcuts.map(([label, hours]) => (
              <button
                className="redeem-preset"
                key={label}
                onClick={() => set({ expiresAt: expiryAfter(new Date(), hours) })}
                type="button"
              >
                {label}
              </button>
            ))}
            <button
              className="redeem-preset"
              disabled={!draft.expiresAt}
              onClick={() => set({ expiresAt: '' })}
              type="button"
            >
              Nunca
            </button>
          </fieldset>
          <small className={expiryInvalid ? 'redeem-warning' : undefined}>
            {expiryInvalid
              ? 'Esta data já passou: ninguém conseguirá resgatar.'
              : 'Horário local. Vazio = não expira.'}
          </small>
        </div>
        <div className="redeem-field">
          <span aria-hidden="true">Status</span>
          <label className="redeem-toggle">
            <input
              checked={draft.active}
              type="checkbox"
              onChange={(event) => set({ active: event.target.checked })}
            />
            Ativo
          </label>
          <small>Desmarque para pausar sem apagar.</small>
        </div>
      </fieldset>

      <output className="redeem-preview" aria-live="polite">
        <span className="redeem-preview-label">Prévia</span>
        <span>
          Quem resgatar <code>{summary.code}</code> recebe <strong>{summary.reward}</strong>
          {draft.active ? '' : ' (código desativado)'}.
        </span>
        <small>{summary.conditions}</small>
      </output>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="redeem-form-actions">
        <button className="ops-button accent" disabled={pending} type="submit">
          {pending ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar código'}
        </button>
        {editing ? (
          <button
            className="ops-button secondary"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            Cancelar edição
          </button>
        ) : null}
        {editing ? <small className="redeem-shortcut">Esc cancela</small> : null}
      </div>
    </form>
  );
}

function RedeemCodeRow({
  code,
  now,
  editing,
  onEdit,
  onChanged,
  onDeleted,
}: {
  code: AdminRedeemCode;
  now: Date;
  editing: boolean;
  onEdit: () => void;
  onChanged: (code: AdminRedeemCode) => void;
  onDeleted: (id: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const status = redeemCodeStatus(code, now);
  const share = claimsShare(code);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  const toggle = () =>
    run(async () => {
      const result = inputFrom({ ...draftFrom(code), active: !code.active });
      if ('error' in result) throw new Error(result.error);
      onChanged(await putV1AdminRedeemCodesId(code.id, result.input, adminApiOptions()));
    });

  const remove = () => {
    if (!window.confirm(`Excluir o código ${code.code}? Esta ação não pode ser desfeita.`)) return;
    void run(async () => {
      await deleteV1AdminRedeemCodesId(code.id, adminApiOptions());
      onDeleted(code.id);
    });
  };

  return (
    <li
      aria-busy={pending}
      aria-current={editing || undefined}
      className={`redeem-row redeem-row--${status}`}
    >
      <div className="redeem-row-main">
        <div className="redeem-code-line">
          <code className="redeem-code">{code.code}</code>
          <CopyButton text={code.code} />
        </div>
        <span className={`redeem-status redeem-status--${status}`}>
          {editing ? 'Editando · ' : ''}
          {statusLabels[status]}
        </span>
      </div>
      <dl className="redeem-row-facts">
        <div>
          <dt>Recompensa</dt>
          <dd>{rewardLabel(code.reward)}</dd>
        </div>
        <div>
          <dt>Resgates</dt>
          <dd>
            {code.claims.toLocaleString('pt-BR')}
            {code.maxClaims === null
              ? ' · sem limite'
              : ` de ${code.maxClaims.toLocaleString('pt-BR')}`}
            {share === null ? null : (
              <span aria-hidden="true" className="redeem-meter">
                <span style={{ width: `${share * 100}%` }} />
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Expira</dt>
          <dd>
            {code.expiresAt ? (
              <time
                dateTime={code.expiresAt}
                title={new Date(code.expiresAt).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              >
                {expiryLabel(code.expiresAt, now)}
              </time>
            ) : (
              'Nunca'
            )}
          </dd>
        </div>
      </dl>
      <div className="redeem-row-actions">
        <button
          aria-label={`Editar ${code.code}`}
          className="ops-button secondary"
          disabled={pending || editing}
          onClick={onEdit}
          type="button"
        >
          Editar
        </button>
        <button
          aria-label={`${code.active ? 'Desativar' : 'Ativar'} ${code.code}`}
          className="ops-button secondary"
          disabled={pending}
          onClick={() => void toggle()}
          title={
            !code.active &&
            status === 'inactive' &&
            redeemCodeStatus({ ...code, active: true }, now) !== 'active'
              ? 'Mesmo ativado, o código continuará expirado ou esgotado.'
              : undefined
          }
          type="button"
        >
          {code.active ? 'Desativar' : 'Ativar'}
        </button>
        <button
          aria-label={`Excluir ${code.code}`}
          className="ops-button danger"
          disabled={pending || code.locked}
          onClick={remove}
          title={code.locked ? 'Códigos já resgatados só podem ser desativados.' : undefined}
          type="button"
        >
          Excluir
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function RedeemCodesPage() {
  const [codes, setCodes] = useState<AdminRedeemCode[] | null>(null);
  const [options, setOptions] = useState<AdminRedeemCodeOptions | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState<AdminRedeemCode | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [notice, setNotice] = useState<{ code: string; created: boolean } | null>(null);
  const now = new Date();

  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter deliberately restarts these GETs.
  useEffect(() => {
    let active = true;
    setError('');
    void Promise.all([
      getV1AdminRedeemCodes(adminApiOptions()),
      getV1AdminRedeemCodesOptions(adminApiOptions()),
    ])
      .then(([loadedCodes, loadedOptions]) => {
        if (!active) return;
        setCodes(byNewest(loadedCodes));
        setOptions(loadedOptions);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [retry]);

  function stored(code: AdminRedeemCode) {
    setCodes((current) =>
      byNewest([...(current ?? []).filter((item) => item.id !== code.id), code]),
    );
  }

  function saved(code: AdminRedeemCode) {
    stored(code);
    setNotice({ code: code.code, created: !editing });
    setEditing(null);
  }

  const statuses = new Map((codes ?? []).map((code) => [code.id, redeemCodeStatus(code, now)]));
  const counts = { all: statuses.size } as Record<StatusFilter, number>;
  for (const status of statusOrder) counts[status] = 0;
  for (const status of statuses.values()) counts[status] += 1;
  const visible =
    codes?.filter(
      (code) =>
        (statusFilter === 'all' || statuses.get(code.id) === statusFilter) &&
        matchesQuery(code, query),
    ) ?? [];
  const filtered = statusFilter !== 'all' || query.trim() !== '';

  return (
    <section className="redeem-codes" aria-labelledby="redeem-codes-title">
      <header className="command-header">
        <div>
          <p className="eyebrow">Operação / Economia</p>
          <h1 className="page-title" id="redeem-codes-title">
            <AdminIcon className="page-title-icon" name="shop" />
            <span>Códigos de resgate</span>
          </h1>
          <p>
            Crie códigos promocionais que concedem moedas, cartas, packs ou campos. Cada jogador
            resgata um código uma vez com <code>/resgatar</code>.
          </p>
        </div>
      </header>

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
      ) : !codes || !options ? (
        <output>Carregando códigos de resgate…</output>
      ) : (
        <>
          <RedeemCodeForm
            editing={editing}
            key={editing?.id ?? 'new'}
            onCancel={() => setEditing(null)}
            onSaved={saved}
            options={options}
          />
          {notice ? (
            <output className="redeem-notice">
              <span>
                {notice.created ? 'Código ' : 'Alterações em '}
                <code>{notice.code}</code>
                {notice.created
                  ? ' criado. Divulgue para os jogadores usarem em /resgatar.'
                  : ' salvas.'}
              </span>
              <CopyButton text={notice.code} />
              <button
                aria-label="Fechar aviso"
                className="redeem-notice-close"
                onClick={() => setNotice(null)}
                type="button"
              >
                ×
              </button>
            </output>
          ) : null}
          <div className="redeem-toolbar">
            <label className="redeem-field">
              <span className="sr-only">Buscar por código ou recompensa</span>
              <input
                placeholder="Buscar por código ou recompensa"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <fieldset className="redeem-filters">
              <legend className="sr-only">Filtrar por status</legend>
              {(['all', ...statusOrder] as const).map((status) => (
                <button
                  aria-pressed={statusFilter === status}
                  className={`redeem-filter redeem-filter--${status}`}
                  disabled={status !== 'all' && counts[status] === 0 && statusFilter !== status}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  {status === 'all' ? 'Todos' : statusLabels[status]}
                  <span>{counts[status]}</span>
                </button>
              ))}
            </fieldset>
            <output>
              {filtered ? `${visible.length} de ${codes.length}` : codes.length}{' '}
              {codes.length === 1 ? 'código' : 'códigos'}
            </output>
          </div>
          {visible.length ? (
            <ul className="redeem-list">
              {visible.map((code) => (
                <RedeemCodeRow
                  code={code}
                  editing={editing?.id === code.id}
                  key={code.id}
                  now={now}
                  onChanged={(changed) => {
                    stored(changed);
                    // The open form would otherwise save a stale `active` back.
                    if (editing?.id === changed.id) setEditing(null);
                  }}
                  onDeleted={(id) => {
                    setCodes((current) => current?.filter((item) => item.id !== id) ?? current);
                    if (editing?.id === id) setEditing(null);
                  }}
                  onEdit={() => {
                    setNotice(null);
                    setEditing(code);
                  }}
                />
              ))}
            </ul>
          ) : (
            <div className="redeem-empty">
              <p>
                {codes.length
                  ? 'Nenhum código encontrado com estes filtros.'
                  : 'Nenhum código criado. Use o formulário acima para criar o primeiro.'}
              </p>
              {filtered ? (
                <button
                  className="ops-button secondary"
                  onClick={() => {
                    setQuery('');
                    setStatusFilter('all');
                  }}
                  type="button"
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}
