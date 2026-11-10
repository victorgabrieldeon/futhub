import {
  type AdminMission,
  type AdminMissionOptions,
  ApiClientError,
  deleteV1AdminMissionsId,
  getV1AdminMissions,
  getV1AdminMissionsOptions,
  postV1AdminMissions,
  putV1AdminMissionsId,
} from '@futhub/api-client';
import { type FormEvent, useEffect, useState } from 'react';
import { adminApiOptions } from '../../api/admin-client';
import { AdminIcon } from '../../components/admin-icon';
import './missions.css';
import {
  type MissionCadence,
  type MissionDraft,
  type MissionRewardDraft,
  type MissionType,
  type RewardType,
  cadenceLabels,
  draftFrom,
  emptyDraft,
  goalUnit,
  inputFrom,
  missionTypeLabels,
  newRewardDraft,
  rewardLabel,
  rewardTypeLabels,
  slotsPerCadence,
  suggestedTitle,
} from './mission-form';

const cadences: readonly MissionCadence[] = ['daily', 'weekly', 'monthly'];
const cadenceSections: Record<MissionCadence, string> = {
  daily: 'Diárias',
  weekly: 'Semanais',
  monthly: 'Mensais',
};
const cadenceResets: Record<MissionCadence, string> = {
  daily: 'Renova todo dia às 00:00 UTC.',
  weekly: 'Renova toda segunda-feira às 00:00 UTC.',
  monthly: 'Renova no dia 1º às 00:00 UTC.',
};
const resourceLimit = 200;

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiClientError && cause.status === 401) window.location.assign('/login');
  if (cause instanceof ApiClientError)
    return cause.message.replace(/^FutHub API request failed with status \d+: /, '');
  if (cause instanceof Error) return cause.message;
  return 'Não foi possível concluir a solicitação.';
}

function byCycle(missions: AdminMission[]): AdminMission[] {
  return [...missions].sort(
    (a, b) =>
      cadences.indexOf(a.cadence) - cadences.indexOf(b.cadence) ||
      a.tier - b.tier ||
      a.title.localeCompare(b.title, 'pt-BR'),
  );
}

function resourcesFor(options: AdminMissionOptions, type: RewardType) {
  if (type === 'card') return options.cards;
  if (type === 'pack') return options.packs;
  if (type === 'field') return options.fields;
  return [];
}

function RewardFields({
  reward,
  index,
  options,
  removable,
  onChange,
  onRemove,
}: {
  reward: MissionRewardDraft;
  index: number;
  options: AdminMissionOptions;
  removable: boolean;
  onChange: (patch: Partial<MissionRewardDraft>) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState('');
  const resources = resourcesFor(options, reward.type);
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const matches = resources.filter(
    (resource) =>
      resource.id === reward.resourceId ||
      resource.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
  );

  return (
    <li className="mission-reward">
      <label className="mission-field">
        Recompensa {index + 1}
        <select
          value={reward.type}
          onChange={(event) => {
            onChange({ type: event.target.value as RewardType, resourceId: '', amount: '1' });
            setQuery('');
          }}
        >
          {Object.entries(rewardTypeLabels).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="mission-field">
        Quantidade
        <input
          inputMode="numeric"
          min={1}
          max={reward.type === 'field' ? 1 : undefined}
          required
          type="number"
          value={reward.amount}
          onChange={(event) => onChange({ amount: event.target.value })}
        />
      </label>
      {reward.type !== 'balance' ? (
        <div className="mission-resource">
          {resources.length > 20 ? (
            <label className="mission-field">
              Buscar {rewardTypeLabels[reward.type].toLowerCase()}
              <input
                placeholder="Digite parte do nome"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          ) : null}
          <label className="mission-field">
            {rewardTypeLabels[reward.type]} concedido
            <select
              required
              value={reward.resourceId}
              onChange={(event) => onChange({ resourceId: event.target.value })}
            >
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
              <small>Nenhum item deste tipo cadastrado.</small>
            ) : null}
          </label>
        </div>
      ) : null}
      <button
        aria-label={`Remover recompensa ${index + 1}`}
        className="ops-button secondary mission-reward-remove"
        disabled={!removable}
        onClick={onRemove}
        type="button"
      >
        Remover
      </button>
    </li>
  );
}

function MissionForm({
  editing,
  options,
  onSaved,
  onCancel,
}: {
  editing: AdminMission | null;
  options: AdminMissionOptions;
  onSaved: (mission: AdminMission) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<MissionDraft>(() =>
    editing ? draftFrom(editing) : emptyDraft(),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const locked = editing?.locked ?? false;
  const set = (patch: Partial<MissionDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const setReward = (key: string, patch: Partial<MissionRewardDraft>) =>
    setDraft((current) => ({
      ...current,
      rewards: current.rewards.map((reward) =>
        reward.key === key ? { ...reward, ...patch } : reward,
      ),
    }));
  const goal = Number(draft.goal);

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
          ? await putV1AdminMissionsId(editing.id, result.input, adminApiOptions())
          : await postV1AdminMissions(result.input, adminApiOptions()),
      );
      if (!editing) setDraft(emptyDraft());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="mission-form"
      aria-busy={pending}
      aria-labelledby="mission-form-title"
      onSubmit={(event) => void submit(event)}
    >
      <div className="mission-form-heading">
        <h2 id="mission-form-title">{editing ? `Editar ${editing.title}` : 'Nova missão'}</h2>
        {locked ? (
          <p>
            Já atribuída {editing?.assignments} vez(es): tipo, ciclo, tier e meta ficam fixos para
            não mudar o progresso dos jogadores. Título, recompensas e status continuam editáveis.
          </p>
        ) : (
          <p>
            Ao abrir o ciclo, cada jogador recebe uma missão ativa sorteada por tier. A recompensa é
            entregue automaticamente quando a meta é batida.
          </p>
        )}
      </div>

      <fieldset className="mission-fieldset" disabled={pending}>
        <legend>Missão</legend>
        <label className="mission-field mission-field--wide">
          Título
          <input
            maxLength={120}
            placeholder={suggestedTitle(draft.type, draft.goal)}
            value={draft.title}
            onChange={(event) => set({ title: event.target.value })}
          />
          <small>Vazio = usa a sugestão. Aparece em /missoes e no aviso de conclusão.</small>
        </label>
        <label className="mission-field">
          Objetivo
          <select
            disabled={locked}
            value={draft.type}
            onChange={(event) => set({ type: event.target.value as MissionType })}
          >
            {Object.entries(missionTypeLabels).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="mission-field">
          Meta
          <input
            disabled={locked}
            inputMode="numeric"
            min={1}
            required
            type="number"
            value={draft.goal}
            onChange={(event) => set({ goal: event.target.value })}
          />
          <small>
            {Number.isSafeInteger(goal) && goal > 0
              ? `${goal.toLocaleString('pt-BR')} ${goalUnit(draft.type, goal)}`
              : 'Inteiro maior que zero.'}
          </small>
        </label>
        <label className="mission-field">
          Ciclo
          <select
            disabled={locked}
            value={draft.cadence}
            onChange={(event) => set({ cadence: event.target.value as MissionCadence })}
          >
            {cadences.map((cadence) => (
              <option key={cadence} value={cadence}>
                {cadenceLabels[cadence]}
              </option>
            ))}
          </select>
          <small>{cadenceResets[draft.cadence]}</small>
        </label>
        <label className="mission-field">
          Tier
          <input
            disabled={locked}
            inputMode="numeric"
            max={10}
            min={1}
            required
            type="number"
            value={draft.tier}
            onChange={(event) => set({ tier: event.target.value })}
          />
          <small>Missões do mesmo ciclo e tier disputam o mesmo espaço.</small>
        </label>
        <label className="mission-toggle">
          <input
            checked={draft.active}
            type="checkbox"
            onChange={(event) => set({ active: event.target.checked })}
          />
          Ativa
        </label>
      </fieldset>

      <fieldset className="mission-fieldset mission-fieldset--rewards" disabled={pending}>
        <legend>Recompensas sorteadas</legend>
        <p className="mission-hint">
          Uma recompensa da lista é sorteada quando a missão é atribuída ao jogador.
        </p>
        <ul className="mission-rewards">
          {draft.rewards.map((reward, index) => (
            <RewardFields
              index={index}
              key={reward.key}
              onChange={(patch) => setReward(reward.key, patch)}
              onRemove={() =>
                set({ rewards: draft.rewards.filter((item) => item.key !== reward.key) })
              }
              options={options}
              removable={draft.rewards.length > 1}
              reward={reward}
            />
          ))}
        </ul>
        <button
          className="ops-button secondary mission-reward-add"
          disabled={draft.rewards.length >= 20}
          onClick={() => set({ rewards: [...draft.rewards, newRewardDraft()] })}
          type="button"
        >
          Adicionar recompensa
        </button>
      </fieldset>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mission-form-actions">
        <button className="ops-button accent" disabled={pending} type="submit">
          {pending ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar missão'}
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

function MissionRow({
  mission,
  onEdit,
  onChanged,
  onDeleted,
}: {
  mission: AdminMission;
  onEdit: () => void;
  onChanged: (mission: AdminMission) => void;
  onDeleted: (id: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

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
      const result = inputFrom({ ...draftFrom(mission), active: !mission.active });
      if ('error' in result) throw new Error(result.error);
      onChanged(await putV1AdminMissionsId(mission.id, result.input, adminApiOptions()));
    });

  const remove = () => {
    if (!window.confirm(`Excluir a missão "${mission.title}"? Esta ação não pode ser desfeita.`))
      return;
    void run(async () => {
      await deleteV1AdminMissionsId(mission.id, adminApiOptions());
      onDeleted(mission.id);
    });
  };

  return (
    <li className="mission-row" aria-busy={pending}>
      <div className="mission-row-main">
        <span className="mission-tier">Tier {mission.tier}</span>
        <strong>{mission.title}</strong>
        <span className={`mission-status mission-status--${mission.active ? 'active' : 'off'}`}>
          {mission.active ? 'Ativa' : 'Desativada'}
        </span>
      </div>
      <dl className="mission-row-facts">
        <div>
          <dt>Objetivo</dt>
          <dd>
            {missionTypeLabels[mission.type]} · {mission.goal.toLocaleString('pt-BR')}{' '}
            {goalUnit(mission.type, mission.goal)}
          </dd>
        </div>
        <div>
          <dt>Recompensas</dt>
          <dd>{mission.rewards.map(rewardLabel).join(' ou ') || 'Nenhuma'}</dd>
        </div>
        <div>
          <dt>Atribuições</dt>
          <dd>{mission.assignments.toLocaleString('pt-BR')}</dd>
        </div>
      </dl>
      <div className="mission-row-actions">
        <button className="ops-button secondary" disabled={pending} onClick={onEdit} type="button">
          Editar
        </button>
        <button
          className="ops-button secondary"
          disabled={pending}
          onClick={() => void toggle()}
          type="button"
        >
          {mission.active ? 'Desativar' : 'Ativar'}
        </button>
        <button
          aria-label={`Excluir ${mission.title}`}
          className="ops-button danger"
          disabled={pending || mission.locked}
          onClick={remove}
          title={mission.locked ? 'Missões já atribuídas só podem ser desativadas.' : undefined}
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

export function MissionsPage() {
  const [missions, setMissions] = useState<AdminMission[] | null>(null);
  const [options, setOptions] = useState<AdminMissionOptions | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState<AdminMission | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter deliberately restarts these GETs.
  useEffect(() => {
    let active = true;
    setError('');
    void Promise.all([
      getV1AdminMissions(adminApiOptions()),
      getV1AdminMissionsOptions(adminApiOptions()),
    ])
      .then(([loadedMissions, loadedOptions]) => {
        if (!active) return;
        setMissions(byCycle(loadedMissions));
        setOptions(loadedOptions);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [retry]);

  function saved(mission: AdminMission) {
    setMissions((current) =>
      byCycle([...(current ?? []).filter((item) => item.id !== mission.id), mission]),
    );
    setEditing(null);
  }

  const slots = missions ? slotsPerCadence(missions) : null;

  return (
    <section className="missions" aria-labelledby="missions-title">
      <header className="command-header">
        <div>
          <p className="eyebrow">Operação / Engajamento</p>
          <h1 className="page-title" id="missions-title">
            <AdminIcon className="page-title-icon" name="cards" />
            <span>Missões</span>
          </h1>
          <p>
            Defina missões diárias, semanais e mensais. Os jogadores acompanham o progresso em{' '}
            <code>/missoes</code> e recebem um aviso com a recompensa ao concluir. O texto do aviso
            é editável em Respostas do bot.
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
      ) : !missions || !options || !slots ? (
        <output>Carregando missões…</output>
      ) : (
        <>
          <MissionForm
            editing={editing}
            key={editing?.id ?? 'new'}
            onCancel={() => setEditing(null)}
            onSaved={saved}
            options={options}
          />
          {cadences.map((cadence) => {
            const group = missions.filter((mission) => mission.cadence === cadence);
            return (
              <section
                aria-labelledby={`missions-${cadence}`}
                className="mission-group"
                key={cadence}
              >
                <header className="mission-group-header">
                  <h2 id={`missions-${cadence}`}>{cadenceSections[cadence]}</h2>
                  <output>
                    {slots[cadence] === 1
                      ? '1 missão por jogador'
                      : `${slots[cadence]} missões por jogador`}{' '}
                    · {cadenceResets[cadence]}
                  </output>
                </header>
                {group.length ? (
                  <ul className="mission-list">
                    {group.map((mission) => (
                      <MissionRow
                        key={mission.id}
                        mission={mission}
                        onChanged={saved}
                        onDeleted={(id) =>
                          setMissions(
                            (current) => current?.filter((item) => item.id !== id) ?? current,
                          )
                        }
                        onEdit={() => {
                          setEditing(mission);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="mission-empty">
                    Nenhuma missão {cadenceLabels[cadence].toLowerCase()} cadastrada.
                  </p>
                )}
              </section>
            );
          })}
        </>
      )}
    </section>
  );
}
