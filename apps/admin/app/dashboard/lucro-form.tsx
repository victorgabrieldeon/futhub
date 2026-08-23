'use client';

import {
  DiscordBold,
  DiscordEmbed,
  DiscordEmbedDescription,
  DiscordEmbedFooter,
  DiscordMessage,
  DiscordMessages,
} from '@skyra/discord-components-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useRef, useState } from 'react';

import type {
  LucroConfig,
  LucroConfigInput,
  LucroEmbed,
  LucroEmbedSchema,
  LucroReward,
  LucroRewardMessages,
} from '../../lib/lucro';

type ActiveTab = 'cooldown' | 'rewards' | 'embed';
type CooldownUnit = 'seconds' | 'minutes' | 'hours';
type RewardDraft = { key: string; value: string; weight: string; messages: LucroRewardMessages };
type RewardFormDraft = Omit<RewardDraft, 'key'>;

const tabs: ReadonlyArray<Readonly<{ id: ActiveTab; label: string }>> = [
  { id: 'cooldown', label: 'Cooldown' },
  { id: 'rewards', label: 'Lucros' },
  { id: 'embed', label: 'Embed Discord' },
];
const cooldownUnitLabels: Record<CooldownUnit, string> = {
  seconds: 'segundos',
  minutes: 'minutos',
  hours: 'horas',
};
const cooldownUnitSeconds: Record<CooldownUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
};

function cooldownUnitFor(seconds: number): CooldownUnit {
  if (seconds % 3600 === 0) return 'hours';
  if (seconds % 60 === 0) return 'minutes';
  return 'seconds';
}

function draftFrom(reward: Omit<LucroReward, 'id'>, key = crypto.randomUUID()): RewardDraft {
  return { ...reward, value: String(reward.value), weight: String(reward.weight), key };
}

function emptyRewardDraft(): RewardFormDraft {
  return { value: '', weight: '1', messages: { pt: '', es: '', en: '' } };
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [
    hours ? `${hours} h` : null,
    minutes ? `${minutes} min` : null,
    remainder ? `${remainder} s` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

function renderPreview(template: string) {
  const preview = Object.entries({
    message: 'Lucro raro: +500',
    reward: '500',
    balance: '4.250',
    xp: '10',
    level: '12',
    availableAt: 'amanhã às 12:00',
  }).reduce((result, [token, value]) => result.replaceAll(`{${token}}`, value), template);
  const occurrences = new Map<string, number>();

  return preview.split(/(\*\*[^*]+\*\*|\n)/g).map((part) => {
    const occurrence = occurrences.get(part) ?? 0;
    occurrences.set(part, occurrence + 1);
    const key = `${part}-${occurrence}`;
    if (part === '\n') return <br key={key} />;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <DiscordBold key={key}>{part.slice(2, -2)}</DiscordBold>;
    }
    return part;
  });
}

export function LucroForm({
  config,
  embedSchema,
}: Readonly<{ config: LucroConfig; embedSchema: LucroEmbedSchema }>) {
  const router = useRouter();
  const initialCooldownUnit = cooldownUnitFor(config.cooldownSeconds);
  const [activeTab, setActiveTab] = useState<ActiveTab>('cooldown');
  const [cooldownUnit, setCooldownUnit] = useState<CooldownUnit>(initialCooldownUnit);
  const [cooldownValue, setCooldownValue] = useState(
    String(config.cooldownSeconds / cooldownUnitSeconds[initialCooldownUnit]),
  );
  const [rewards, setRewards] = useState<RewardDraft[]>(() =>
    config.rewards.map(({ id: _id, ...reward }) => draftFrom(reward)),
  );
  const [embed, setEmbed] = useState<LucroEmbed>(config.embed);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const rewardDialogRef = useRef<HTMLDialogElement>(null);
  const [rewardToEdit, setRewardToEdit] = useState<number | null>(null);
  const [rewardDraft, setRewardDraft] = useState<RewardFormDraft>(emptyRewardDraft);
  const [rewardDialogError, setRewardDialogError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const totalWeight = rewards.reduce((total, reward) => total + (Number(reward.weight) || 0), 0);
  const cooldownSeconds = Number(cooldownValue) * cooldownUnitSeconds[cooldownUnit];
  const embedProperty = (field: keyof LucroEmbed) => embedSchema.properties[field];

  function change(): void {
    setSaved(false);
    setError(null);
  }

  function updateReward(index: number, field: keyof Omit<RewardDraft, 'key'>, value: string): void {
    change();
    setRewards((current) =>
      current.map((reward, rewardIndex) =>
        rewardIndex === index ? { ...reward, [field]: value } : reward,
      ),
    );
  }

  function moveReward(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= rewards.length) return;
    change();
    setRewards((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateEmbed(field: keyof LucroEmbed, value: string): void {
    change();
    setEmbed((current) => ({ ...current, [field]: value }));
  }

  function openRewardDialog(index?: number): void {
    const reward = index === undefined ? emptyRewardDraft() : rewards[index];
    setRewardToEdit(index ?? null);
    setRewardDraft({
      value: reward.value,
      weight: reward.weight,
      messages: { ...reward.messages },
    });
    setRewardDialogError(null);
    rewardDialogRef.current?.showModal();
  }

  function closeRewardDialog(): void {
    rewardDialogRef.current?.close();
  }

  function saveRewardDialog(): void {
    const value = Number(rewardDraft.value);
    const weight = Number(rewardDraft.weight);
    const messages = {
      pt: rewardDraft.messages.pt.trim(),
      es: rewardDraft.messages.es.trim(),
      en: rewardDraft.messages.en.trim(),
    };
    if (
      !Number.isInteger(value) ||
      value < 1 ||
      !Number.isInteger(weight) ||
      weight < 1 ||
      Object.values(messages).some((message) => !message || message.length > 280)
    ) {
      setRewardDialogError('Preencha valor, peso e mensagens válidas nos três idiomas.');
      return;
    }
    const reward = { value: String(value), weight: String(weight), messages };
    change();
    setRewards((current) =>
      rewardToEdit === null
        ? [...current, { ...reward, key: crypto.randomUUID() }]
        : current.map((currentReward, index) =>
            index === rewardToEdit ? { ...reward, key: currentReward.key } : currentReward,
          ),
    );
    closeRewardDialog();
  }

  function insertVariable(token: string): void {
    const input = descriptionRef.current;
    const start = input?.selectionStart ?? embed.description.length;
    const end = input?.selectionEnd ?? start;
    const description = `${embed.description.slice(0, start)}${token}${embed.description.slice(end)}`;
    updateEmbed('description', description);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function changeCooldownUnit(nextUnit: CooldownUnit): void {
    const nextValue = cooldownSeconds / cooldownUnitSeconds[nextUnit];
    change();
    setCooldownUnit(nextUnit);
    if (Number.isFinite(nextValue)) setCooldownValue(String(nextValue));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    change();

    if (!Number.isInteger(cooldownSeconds) || cooldownSeconds < 1) {
      setActiveTab('cooldown');
      setError('Informe um cooldown inteiro maior que zero.');
      return;
    }
    if (rewards.length === 0) {
      setActiveTab('rewards');
      setError('Inclua ao menos uma recompensa.');
      return;
    }

    const parsedRewards = rewards.map((reward) => ({
      value: Number(reward.value),
      weight: Number(reward.weight),
      messages: {
        pt: reward.messages.pt.trim(),
        es: reward.messages.es.trim(),
        en: reward.messages.en.trim(),
      },
    }));
    if (
      parsedRewards.some(
        (reward) =>
          !Number.isInteger(reward.value) ||
          reward.value < 1 ||
          !Number.isInteger(reward.weight) ||
          reward.weight < 1 ||
          Object.values(reward.messages).some((message) => !message),
      )
    ) {
      setActiveTab('rewards');
      setError('Cada faixa precisa de valor, peso e mensagem válidos.');
      return;
    }
    if (!embed.title.trim() || !embed.description.trim() || !/^#[\dA-Fa-f]{6}$/.test(embed.color)) {
      setActiveTab('embed');
      setError('Preencha título, descrição e uma cor hexadecimal válida para a embed.');
      return;
    }

    setPending(true);
    const payload: LucroConfigInput = {
      cooldownSeconds,
      rewards: parsedRewards,
      embed: {
        title: embed.title.trim(),
        description: embed.description.trim(),
        color: embed.color,
        footer: embed.footer.trim(),
      },
    };
    const response = await fetch('/api/lucro', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as
      | LucroConfig
      | { error?: string }
      | null;
    if (!response.ok) {
      if (response.status === 401) window.location.assign('/login');
      else
        setError(
          body && 'error' in body
            ? (body.error ?? 'Não foi possível salvar.')
            : 'Não foi possível salvar.',
        );
      setPending(false);
      return;
    }

    const savedConfig = body as LucroConfig;
    const savedUnit = cooldownUnitFor(savedConfig.cooldownSeconds);
    setCooldownUnit(savedUnit);
    setCooldownValue(String(savedConfig.cooldownSeconds / cooldownUnitSeconds[savedUnit]));
    setRewards(savedConfig.rewards.map(({ id: _id, ...reward }) => draftFrom(reward)));
    setEmbed(savedConfig.embed);
    setSaved(true);
    setPending(false);
    router.refresh();
  }

  return (
    <form className="config-card" onSubmit={submit}>
      <div className="command-tabs" aria-label="Configuração do comando" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-controls={`${tab.id}-panel`}
            aria-selected={activeTab === tab.id}
            className="command-tab"
            id={`${tab.id}-tab`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'cooldown' ? (
        <section
          aria-labelledby="cooldown-tab"
          className="form-section"
          id="cooldown-panel"
          role="tabpanel"
        >
          <div className="card-heading">
            <div>
              <p className="eyebrow">Ritmo do comando</p>
              <h2>Cooldown</h2>
            </div>
            <span className="badge">
              {formatDuration(Number.isFinite(cooldownSeconds) ? cooldownSeconds : 0)}
            </span>
          </div>
          <div className="cooldown-controls">
            <label htmlFor="cooldownValue">
              Intervalo entre resgates
              <input
                id="cooldownValue"
                min="0.0002777778"
                onChange={(event) => {
                  change();
                  setCooldownValue(event.target.value);
                }}
                required
                step="any"
                type="number"
                value={cooldownValue}
              />
            </label>
            <label htmlFor="cooldownUnit">
              Unidade
              <select
                id="cooldownUnit"
                onChange={(event) => changeCooldownUnit(event.target.value as CooldownUnit)}
                value={cooldownUnit}
              >
                {(Object.keys(cooldownUnitLabels) as CooldownUnit[]).map((unit) => (
                  <option key={unit} value={unit}>
                    {cooldownUnitLabels[unit]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="field-note">
            O bot libera novo uso após {formatDuration(cooldownSeconds || 0)}.
          </p>
        </section>
      ) : null}

      {activeTab === 'rewards' ? (
        <section
          aria-labelledby="rewards-tab"
          className="form-section reward-list"
          id="rewards-panel"
          role="tabpanel"
        >
          <div className="reward-list-header">
            <div>
              <p className="eyebrow">Economia</p>
              <h2>Lucros</h2>
              <p>Peso total: {totalWeight || '—'}</p>
            </div>
            <button className="button-secondary" onClick={() => openRewardDialog()} type="button">
              Adicionar lucro
            </button>
          </div>
          {rewards.map((reward, index) => {
            const chance =
              totalWeight > 0 ? ((Number(reward.weight) / totalWeight) * 100).toFixed(1) : '—';
            return (
              <fieldset className="reward-row" key={reward.key}>
                <legend>Faixa {index + 1}</legend>
                <label>
                  Valor
                  <input
                    min="1"
                    onChange={(event) => updateReward(index, 'value', event.target.value)}
                    required
                    step="1"
                    type="number"
                    value={reward.value}
                  />
                </label>
                <label>
                  Peso
                  <input
                    min="1"
                    onChange={(event) => updateReward(index, 'weight', event.target.value)}
                    required
                    step="1"
                    type="number"
                    value={reward.weight}
                  />
                </label>
                <output className="chance-output">{chance}% de chance</output>
                <output className="reward-message">{reward.messages.pt}</output>
                <div className="reward-actions" aria-label={`Ações da faixa ${index + 1}`}>
                  <button
                    className="button-secondary"
                    onClick={() => openRewardDialog(index)}
                    type="button"
                  >
                    Editar
                  </button>
                  <button
                    aria-label={`Mover faixa ${index + 1} para cima`}
                    className="icon-button"
                    disabled={index === 0}
                    onClick={() => moveReward(index, -1)}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Mover faixa ${index + 1} para baixo`}
                    className="icon-button"
                    disabled={index === rewards.length - 1}
                    onClick={() => moveReward(index, 1)}
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`Excluir faixa ${index + 1}`}
                    className="remove-button"
                    disabled={rewards.length === 1}
                    onClick={() => {
                      change();
                      setRewards((current) =>
                        current.filter((_, rewardIndex) => rewardIndex !== index),
                      );
                    }}
                    type="button"
                  >
                    Remover
                  </button>
                </div>
              </fieldset>
            );
          })}
        </section>
      ) : null}

      <dialog
        aria-labelledby="reward-dialog-title"
        className="reward-dialog"
        onClose={() => {
          setRewardToEdit(null);
          setRewardDraft(emptyRewardDraft());
          setRewardDialogError(null);
        }}
        ref={rewardDialogRef}
      >
        <div className="reward-dialog-content">
          <div className="reward-dialog-header">
            <div>
              <p className="eyebrow">Economia</p>
              <h2 id="reward-dialog-title">
                {rewardToEdit === null ? 'Adicionar lucro' : 'Editar lucro'}
              </h2>
            </div>
            <button
              aria-label="Fechar"
              className="dialog-close"
              onClick={closeRewardDialog}
              type="button"
            >
              ×
            </button>
          </div>
          <p className="field-note">Defina valor, peso e mensagem para cada idioma.</p>
          <div className="reward-dialog-values">
            <label htmlFor="rewardValue">
              Valor
              <input
                id="rewardValue"
                min="1"
                onChange={(event) =>
                  setRewardDraft((current) => ({ ...current, value: event.target.value }))
                }
                step="1"
                type="number"
                value={rewardDraft.value}
              />
            </label>
            <label htmlFor="rewardWeight">
              Peso
              <input
                id="rewardWeight"
                min="1"
                onChange={(event) =>
                  setRewardDraft((current) => ({ ...current, weight: event.target.value }))
                }
                step="1"
                type="number"
                value={rewardDraft.weight}
              />
            </label>
          </div>
          <div className="reward-message-fields">
            {(
              [
                ['pt', 'Português'],
                ['es', 'Español'],
                ['en', 'English'],
              ] as const
            ).map(([locale, label]) => (
              <label htmlFor={`rewardMessage-${locale}`} key={locale}>
                {label}
                <textarea
                  id={`rewardMessage-${locale}`}
                  maxLength={280}
                  onChange={(event) =>
                    setRewardDraft((current) => ({
                      ...current,
                      messages: { ...current.messages, [locale]: event.target.value },
                    }))
                  }
                  rows={2}
                  value={rewardDraft.messages[locale]}
                />
              </label>
            ))}
          </div>
          {rewardDialogError ? (
            <p className="form-error" role="alert">
              {rewardDialogError}
            </p>
          ) : null}
          <div className="dialog-actions">
            <button className="button-secondary" onClick={closeRewardDialog} type="button">
              Cancelar
            </button>
            <button className="button-primary" onClick={saveRewardDialog} type="button">
              {rewardToEdit === null ? 'Adicionar lucro' : 'Salvar lucro'}
            </button>
          </div>
        </div>
      </dialog>

      {activeTab === 'embed' ? (
        <section
          aria-labelledby="embed-tab"
          className="form-section embed-section"
          id="embed-panel"
          role="tabpanel"
        >
          <div className="card-heading">
            <div>
              <p className="eyebrow">Discord</p>
              <h2>Embed de sucesso</h2>
            </div>
            <span className="badge">JSON Schema</span>
          </div>
          <div className="embed-editor">
            <div className="embed-fields">
              <label htmlFor="embedTitle">
                Título
                <input
                  id="embedTitle"
                  maxLength={embedProperty('title').maxLength}
                  onChange={(event) => updateEmbed('title', event.target.value)}
                  placeholder={embedProperty('title').examples[0]}
                  required
                  value={embed.title}
                />
              </label>
              <label htmlFor="embedDescription">
                Descrição
                <textarea
                  id="embedDescription"
                  maxLength={embedProperty('description').maxLength}
                  onChange={(event) => updateEmbed('description', event.target.value)}
                  onDragOver={(event) => {
                    event.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={() => {
                    requestAnimationFrame(() => {
                      const description = descriptionRef.current?.value;
                      if (description !== undefined) updateEmbed('description', description);
                    });
                  }}
                  placeholder={embedProperty('description').examples[0]}
                  ref={descriptionRef}
                  required
                  rows={7}
                  value={embed.description}
                />
              </label>
              <div className="variable-palette">
                <div>
                  <p className="eyebrow">Dados do comando</p>
                  <p>
                    Arraste uma variável para a posição desejada ou clique para inserir no cursor.
                  </p>
                </div>
                <div className="variable-list">
                  {embedSchema.variables.map((variable) => (
                    <button
                      className="variable-chip"
                      draggable
                      key={variable.token}
                      onClick={() => insertVariable(variable.token)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'copy';
                        event.dataTransfer.setData('text/plain', variable.token);
                      }}
                      title={`${variable.description} Exemplo: ${variable.example}`}
                      type="button"
                    >
                      <code>{variable.token}</code>
                      <span>{variable.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="embed-meta-fields">
                <label htmlFor="embedColor">
                  Cor
                  <input
                    id="embedColor"
                    onChange={(event) => updateEmbed('color', event.target.value)}
                    type="color"
                    value={embed.color}
                  />
                </label>
                <label htmlFor="embedFooter">
                  Rodapé
                  <input
                    id="embedFooter"
                    maxLength={embedProperty('footer').maxLength}
                    onChange={(event) => updateEmbed('footer', event.target.value)}
                    placeholder={embedProperty('footer').examples[0]}
                    value={embed.footer}
                  />
                </label>
              </div>
            </div>
            <div className="embed-preview">
              <span className="preview-label">Prévia Discord</span>
              <DiscordMessages>
                <DiscordMessage author="FutHub" bot>
                  <DiscordEmbed color={embed.color} embedTitle={embed.title} slot="embeds">
                    <DiscordEmbedDescription slot="description">
                      {renderPreview(embed.description)}
                    </DiscordEmbedDescription>
                    {embed.footer ? (
                      <DiscordEmbedFooter slot="footer">{embed.footer}</DiscordEmbedFooter>
                    ) : null}
                  </DiscordEmbed>
                </DiscordMessage>
              </DiscordMessages>
            </div>
          </div>
          <p className="field-note">{embedSchema.description}</p>
        </section>
      ) : null}

      <div className="form-actions">
        <div aria-live="polite">
          {error ? <p className="form-error">{error}</p> : null}
          {saved ? <p className="form-success">Alterações salvas.</p> : null}
        </div>
        <button className="button-primary" disabled={pending} type="submit">
          {pending ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
