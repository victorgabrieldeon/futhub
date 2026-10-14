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
import { type FormEvent, useEffect, useState } from 'react';
import { adminApiOptions } from '../../api/admin-client';
import { AdminIcon } from '../../components/admin-icon';
import './redeem-codes.css';
import {
  type RedeemCodeDraft,
  type RedeemCodeStatus,
  type RewardType,
  canonicalCode,
  draftFrom,
  emptyDraft,
  inputFrom,
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
  const locked = editing?.locked ?? false;
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
      className="redeem-form"
      aria-busy={pending}
      aria-labelledby="redeem-form-title"
      onSubmit={(event) => void submit(event)}
    >
      <div className="redeem-form-heading">
        <h2 id="redeem-form-title">
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
        <label className="redeem-field redeem-field--code">
          Código
          <input
            autoComplete="off"
            maxLength={32}
            placeholder="BEMVINDO"
            required
            spellCheck={false}
            value={draft.code}
            onChange={(event) => set({ code: canonicalCode(event.target.value) })}
          />
          <small>3 a 32 caracteres: letras, números, hífen ou sublinhado.</small>
        </label>
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
            inputMode="numeric"
            min={1}
            max={draft.rewardType === 'field' ? 1 : undefined}
            required
            type="number"
            value={draft.amount}
            onChange={(event) => set({ amount: event.target.value })}
          />
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
        <label className="redeem-field">
          Expira em
          <input
            type="datetime-local"
            value={draft.expiresAt}
            onChange={(event) => set({ expiresAt: event.target.value })}
          />
          <small>Horário local. Vazio = não expira.</small>
        </label>
        <label className="redeem-toggle">
          <input
            checked={draft.active}
            type="checkbox"
            onChange={(event) => set({ active: event.target.checked })}
          />
          Ativo
        </label>
      </fieldset>

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
      </div>
    </form>
  );
}

function RedeemCodeRow({
  code,
  now,
  onEdit,
  onChanged,
  onDeleted,
}: {
  code: AdminRedeemCode;
  now: Date;
  onEdit: () => void;
  onChanged: (code: AdminRedeemCode) => void;
  onDeleted: (id: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const status = redeemCodeStatus(code, now);

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
    <li className="redeem-row" aria-busy={pending}>
      <div className="redeem-row-main">
        <code className="redeem-code">{code.code}</code>
        <span className={`redeem-status redeem-status--${status}`}>{statusLabels[status]}</span>
      </div>
      <dl className="redeem-row-facts">
        <div>
          <dt>Recompensa</dt>
          <dd>{rewardLabel(code.reward)}</dd>
        </div>
        <div>
          <dt>Resgates</dt>
          <dd>
            {code.claims}
            {code.maxClaims === null ? ' · sem limite' : ` de ${code.maxClaims}`}
          </dd>
        </div>
        <div>
          <dt>Expira</dt>
          <dd>
            {code.expiresAt
              ? new Date(code.expiresAt).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : 'Nunca'}
          </dd>
        </div>
      </dl>
      <div className="redeem-row-actions">
        <button className="ops-button secondary" disabled={pending} onClick={onEdit} type="button">
          Editar
        </button>
        <button
          className="ops-button secondary"
          disabled={pending}
          onClick={() => void toggle()}
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

  function saved(code: AdminRedeemCode) {
    setCodes((current) =>
      byNewest([...(current ?? []).filter((item) => item.id !== code.id), code]),
    );
    setEditing(null);
  }

  const normalizedQuery = query.trim().toUpperCase();
  const visible = codes?.filter((code) => code.code.includes(normalizedQuery)) ?? [];

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
          <div className="redeem-toolbar">
            <label className="redeem-field">
              <span className="sr-only">Buscar código</span>
              <input
                placeholder="Buscar código"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <output>{codes.length} códigos</output>
          </div>
          {visible.length ? (
            <ul className="redeem-list">
              {visible.map((code) => (
                <RedeemCodeRow
                  code={code}
                  key={code.id}
                  now={now}
                  onChanged={saved}
                  onDeleted={(id) =>
                    setCodes((current) => current?.filter((item) => item.id !== id) ?? current)
                  }
                  onEdit={() => {
                    setEditing(code);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              ))}
            </ul>
          ) : (
            <p className="redeem-empty">
              {codes.length
                ? 'Nenhum código encontrado para esta busca.'
                : 'Nenhum código criado. Use o formulário acima para criar o primeiro.'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
