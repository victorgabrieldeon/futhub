import {
  DiscordBold,
  DiscordEmbed,
  DiscordEmbedDescription,
  DiscordEmbedFooter,
  DiscordMessage,
  DiscordMessages,
} from '@skyra/discord-components-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { ApiClientError, type LucroConfigInputDto, putV1AdminLucro } from '@futhub/api-client';
import { adminApiOptions } from '../api/admin-client';
import type {
  LucroConfig,
  LucroEmbed,
  LucroEmbedSchema,
  LucroReward,
  LucroRewardMessages,
} from '../lib/lucro';
import { getLucroRewardTier } from '../lib/lucro-economy';
import type { LucroEconomyInput } from '../lib/lucro-economy';

type ActiveTab = 'cooldown' | 'rewards' | 'embed';
type CooldownUnit = 'seconds' | 'minutes' | 'hours';
type RewardDraft = { key: string; value: string; weight: string; messages: LucroRewardMessages };
type RewardFormDraft = Omit<RewardDraft, 'key'>;
type PreviewScenario = 'basic' | 'good' | 'great' | 'random';
type PreviewTestState = 'idle' | 'thinking' | 'complete';
type PreviewValues = Readonly<Record<string, string>>;

const previewScenarioOptions: ReadonlyArray<Readonly<{ id: PreviewScenario; label: string }>> = [
  { id: 'basic', label: 'Lucro básico' },
  { id: 'good', label: 'Bom lucro' },
  { id: 'great', label: 'Grande lucro' },
  { id: 'random', label: 'Aleatório' },
];
const previewVariablePresentation: Readonly<
  Record<string, Readonly<{ icon: string; label: string }>>
> = {
  '{message}': { icon: '✨', label: 'Mensagem' },
  '{reward}': { icon: '💰', label: 'Recompensa' },
  '{balance}': { icon: '👛', label: 'Saldo' },
  '{xp}': { icon: '⭐', label: 'XP' },
  '{level}': { icon: '📈', label: 'Nível' },
  '{availableAt}': { icon: '⏱', label: 'Próximo resgate' },
};
const integerFormatter = new Intl.NumberFormat('pt-BR');

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
const cooldownPresets = [
  { label: '5 min', seconds: 5 * 60 },
  { label: '10 min', seconds: 10 * 60 },
  { label: '30 min', seconds: 30 * 60 },
  { label: '1 hora', seconds: 60 * 60 },
] as const;
const decimalFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

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

function validPreviewRewards(rewards: readonly RewardDraft[]): RewardDraft[] {
  return rewards.filter(
    (reward) => Number.isFinite(Number(reward.value)) && Number(reward.value) > 0,
  );
}

function chooseRandomPreviewReward(rewards: readonly RewardDraft[]): RewardDraft | undefined {
  const candidates = validPreviewRewards(rewards);
  const totalWeight = candidates.reduce(
    (total, reward) => total + Math.max(Number(reward.weight), 0),
    0,
  );
  if (totalWeight <= 0) return candidates[0];

  let position = Math.random() * totalWeight;
  for (const reward of candidates) {
    position -= Math.max(Number(reward.weight), 0);
    if (position < 0) return reward;
  }
  return candidates.at(-1);
}

function previewRewardFor(
  rewards: readonly RewardDraft[],
  scenario: PreviewScenario,
  randomRewardKey: string | null,
): RewardDraft | undefined {
  const sorted = validPreviewRewards(rewards).sort(
    (left, right) => Number(left.value) - Number(right.value),
  );
  if (scenario === 'random')
    return sorted.find((reward) => reward.key === randomRewardKey) ?? sorted[0];
  if (scenario === 'basic') return sorted[0];
  if (scenario === 'good') return sorted[Math.floor(sorted.length / 2)];
  return sorted.at(-1);
}

function previewValuesFor(reward: RewardDraft | undefined, cooldownSeconds: number): PreviewValues {
  const value = Number(reward?.value) || 500;
  const duration = formatDuration(
    Number.isFinite(cooldownSeconds) && cooldownSeconds > 0 ? cooldownSeconds : 600,
  );
  return {
    message: reward?.messages.pt.trim() || `Lucro raro: +${value}`,
    reward: String(value),
    balance: integerFormatter.format(3750 + value),
    xp: '10',
    level: '12',
    availableAt: `em ${duration}`,
  };
}

function renderPreviewText(
  text: string,
  values: PreviewValues,
  highlightedToken: string | null,
  keyPrefix: string,
) {
  return text.split(/(\{[^}]+\})/g).map((part, index) => {
    const value =
      part.startsWith('{') && part.endsWith('}') ? values[part.slice(1, -1)] : undefined;
    if (value === undefined) return part;
    return (
      <span
        className={part === highlightedToken ? 'preview-token-highlight' : undefined}
        key={`${keyPrefix}-${index}`}
      >
        {value}
      </span>
    );
  });
}

function renderPreview(template: string, values: PreviewValues, highlightedToken: string | null) {
  const occurrences = new Map<string, number>();

  return template.split(/(\*\*[^*]+\*\*|\n)/g).map((part) => {
    const occurrence = occurrences.get(part) ?? 0;
    occurrences.set(part, occurrence + 1);
    const key = `${part}-${occurrence}`;
    if (part === '\n') return <br key={key} />;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <DiscordBold key={key}>
          {renderPreviewText(part.slice(2, -2), values, highlightedToken, key)}
        </DiscordBold>
      );
    }
    return renderPreviewText(part, values, highlightedToken, key);
  });
}

export function LucroForm({
  config,
  embedSchema,
  onEconomyChange,
  onRewardsTabChange,
  onSaved,
}: Readonly<{
  config: LucroConfig;
  embedSchema: LucroEmbedSchema;
  onEconomyChange: (economy: LucroEconomyInput) => void;
  onRewardsTabChange: (rewardsSelected: boolean) => void;
  onSaved: (config: LucroConfig) => void;
}>) {
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
  const [previewScenario, setPreviewScenario] = useState<PreviewScenario>('good');
  const [randomPreviewRewardKey, setRandomPreviewRewardKey] = useState<string | null>(null);
  const [previewTestState, setPreviewTestState] = useState<PreviewTestState>('idle');
  const [previewPulse, setPreviewPulse] = useState(0);
  const [highlightedToken, setHighlightedToken] = useState<string | null>(null);
  const testTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const [playerPreviewReady, setPlayerPreviewReady] = useState(false);

  const totalWeight = rewards.reduce((total, reward) => total + (Number(reward.weight) || 0), 0);
  const cooldownSeconds = Number(cooldownValue) * cooldownUnitSeconds[cooldownUnit];
  const embedProperty = (field: keyof LucroEmbed) => embedSchema.properties[field];
  const previewReward = previewRewardFor(rewards, previewScenario, randomPreviewRewardKey);
  const previewValues = previewValuesFor(previewReward, cooldownSeconds);
  const estimatedAverageReward =
    totalWeight > 0
      ? rewards.reduce((total, reward) => total + Number(reward.value) * Number(reward.weight), 0) /
        totalWeight
      : 0;
  const rescuesPerHour = cooldownSeconds > 0 ? 3600 / cooldownSeconds : 0;
  const rescuesPerDay = rescuesPerHour * 24;
  const coinsPerHour = estimatedAverageReward * rescuesPerHour;
  const coinsPerDay = coinsPerHour * 24;
  const sliderMaximum = Math.max(3600, Number.isFinite(cooldownSeconds) ? cooldownSeconds : 0);
  useEffect(() => {
    onEconomyChange({
      cooldownSeconds,
      rewards: rewards.map((reward) => ({
        value: Number(reward.value),
        weight: Number(reward.weight),
      })),
    });
  }, [cooldownSeconds, onEconomyChange, rewards]);

  useEffect(() => {
    onRewardsTabChange(activeTab === 'rewards');
  }, [activeTab, onRewardsTabChange]);

  useEffect(
    () => () => {
      if (testTimerRef.current !== null) window.clearTimeout(testTimerRef.current);
      if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
    },
    [],
  );

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
    flashPreview();
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
    flashPreview(token);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function flashPreview(token: string | null = null): void {
    setPreviewPulse((current) => current + 1);
    setHighlightedToken(token);
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    if (token) {
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedToken(null);
        highlightTimerRef.current = null;
      }, 900);
    }
  }

  function selectPreviewScenario(scenario: PreviewScenario): void {
    setPreviewScenario(scenario);
    if (scenario === 'random') {
      setRandomPreviewRewardKey(chooseRandomPreviewReward(rewards)?.key ?? null);
    }
    flashPreview();
  }

  function testCommand(): void {
    if (previewTestState === 'thinking') return;
    if (previewScenario === 'random') {
      setRandomPreviewRewardKey(chooseRandomPreviewReward(rewards)?.key ?? null);
    }
    if (testTimerRef.current !== null) window.clearTimeout(testTimerRef.current);
    setPreviewTestState('thinking');
    flashPreview();
    testTimerRef.current = window.setTimeout(() => {
      setPreviewTestState('complete');
      testTimerRef.current = null;
      flashPreview();
    }, 800);
  }

  function changeCooldownUnit(nextUnit: CooldownUnit): void {
    const nextValue = cooldownSeconds / cooldownUnitSeconds[nextUnit];
    change();
    setCooldownUnit(nextUnit);
    if (Number.isFinite(nextValue)) setCooldownValue(String(nextValue));
  }

  function setCooldownSeconds(seconds: number): void {
    const unit = cooldownUnitFor(seconds);
    change();
    setCooldownUnit(unit);
    setCooldownValue(String(seconds / cooldownUnitSeconds[unit]));
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
    const payload: LucroConfigInputDto = {
      cooldownSeconds,
      rewards: parsedRewards,
      embed: {
        title: embed.title.trim(),
        description: embed.description.trim(),
        color: embed.color,
        footer: embed.footer.trim(),
      },
    };
    let savedConfig: LucroConfig;
    try {
      savedConfig = (await putV1AdminLucro(payload, adminApiOptions())) as LucroConfig;
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 401) window.location.assign('/login');
      else setError(cause instanceof ApiClientError ? cause.message : 'Não foi possível salvar.');
      setPending(false);
      return;
    }
    const savedUnit = cooldownUnitFor(savedConfig.cooldownSeconds);
    setCooldownUnit(savedUnit);
    setCooldownValue(String(savedConfig.cooldownSeconds / cooldownUnitSeconds[savedUnit]));
    setRewards(savedConfig.rewards.map(({ id: _id, ...reward }) => draftFrom(reward)));
    setEmbed(savedConfig.embed);
    onSaved(savedConfig);
    setSaved(true);
    setPending(false);
  }

  return (
    <form className="lucro-form" onSubmit={submit}>
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
          className="form-section cooldown-section"
          id="cooldown-panel"
          role="tabpanel"
        >
          <div className="card-heading">
            <div>
              <p className="eyebrow">Ritmo do comando</p>
              <h2>Intervalo entre recompensas</h2>
            </div>
            <span className="badge">
              {formatDuration(Number.isFinite(cooldownSeconds) ? cooldownSeconds : 0)}
            </span>
          </div>
          <p className="cooldown-intro">
            Defina quanto tempo cada jogador espera para usar /lucro de novo.
          </p>

          <fieldset className="cooldown-presets">
            <legend>Atalhos rápidos</legend>
            <div>
              {cooldownPresets.map((preset) => (
                <button
                  aria-pressed={cooldownSeconds === preset.seconds}
                  className="cooldown-preset"
                  key={preset.seconds}
                  onClick={() => setCooldownSeconds(preset.seconds)}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
              <span className="cooldown-custom-label">Personalize abaixo</span>
            </div>
          </fieldset>

          <div className="cooldown-slider-control">
            <div className="cooldown-slider-heading">
              <label htmlFor="cooldownRange">Ajuste rápido</label>
              <output aria-live="polite" htmlFor="cooldownRange">
                A cada {formatDuration(cooldownSeconds || 0)}
              </output>
            </div>
            <input
              id="cooldownRange"
              max={sliderMaximum}
              min="1"
              onChange={(event) => setCooldownSeconds(Number(event.target.value))}
              step="1"
              type="range"
              value={Number.isFinite(cooldownSeconds) ? cooldownSeconds : 1}
            />
            <div aria-hidden="true" className="cooldown-slider-scale">
              <span>1 min</span>
              <span>10 min</span>
              <span>1 h</span>
            </div>
          </div>

          <div className="cooldown-controls cooldown-precision-fields">
            <label htmlFor="cooldownValue">
              Valor exato
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

          <section aria-labelledby="cooldown-timeline-title" className="cooldown-timeline-panel">
            <div className="cooldown-panel-heading">
              <p className="eyebrow" id="cooldown-timeline-title">
                Uso do comando
              </p>
              <span>/lucro</span>
            </div>
            <ol className="cooldown-timeline">
              {[0, 1, 2, 3].map((interval) => (
                <li key={interval}>
                  <i aria-hidden="true" />
                  <strong>
                    {interval === 0 ? 'Agora' : `+${formatDuration(cooldownSeconds * interval)}`}
                  </strong>
                  <span>{interval === 0 ? 'Recompensa liberada' : '/lucro disponível'}</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="cooldown-impact-title" className="cooldown-impact">
            <div className="cooldown-panel-heading">
              <div>
                <p className="eyebrow" id="cooldown-impact-title">
                  Impacto estimado
                </p>
                <p>Considera uso máximo e valor médio atual.</p>
              </div>
            </div>
            <dl>
              <div>
                <dt>Resgates por hora</dt>
                <dd>{decimalFormatter.format(rescuesPerHour)}</dd>
              </div>
              <div>
                <dt>Resgates por dia</dt>
                <dd>{decimalFormatter.format(rescuesPerDay)}</dd>
              </div>
              <div>
                <dt>Moedas por hora</dt>
                <dd>{decimalFormatter.format(coinsPerHour)}</dd>
              </div>
              <div>
                <dt>Moedas por jogador/dia</dt>
                <dd>{decimalFormatter.format(coinsPerDay)}</dd>
              </div>
            </dl>
          </section>

          {cooldownSeconds > 0 && cooldownSeconds <= 5 * 60 ? (
            <p className="cooldown-warning" role="status">
              <strong>Cooldown curto</strong>
              <span>
                A distribuição atual pode liberar até {decimalFormatter.format(coinsPerHour)} moedas
                por hora para cada jogador ativo.
              </span>
            </p>
          ) : null}

          <section aria-labelledby="player-cooldown-title" className="player-cooldown-preview">
            <div className="cooldown-panel-heading">
              <div>
                <p className="eyebrow" id="player-cooldown-title">
                  Experiência do jogador
                </p>
                <p>Prévia do próximo uso com alterações não salvas.</p>
              </div>
              <button
                className="player-cooldown-button"
                onClick={() => setPlayerPreviewReady((current) => !current)}
                type="button"
              >
                {playerPreviewReady ? 'Simular novo /lucro' : 'Simular passagem do tempo'}
              </button>
            </div>
            <div
              aria-live="polite"
              className={`player-cooldown-state${playerPreviewReady ? ' is-ready' : ''}`}
            >
              <span aria-hidden="true" className="player-cooldown-symbol">
                {playerPreviewReady ? '✓' : '⏳'}
              </span>
              <div>
                <strong>
                  {playerPreviewReady
                    ? '/lucro disponível'
                    : `+${decimalFormatter.format(estimatedAverageReward)} moedas`}
                </strong>
                <span>
                  {playerPreviewReady
                    ? 'O jogador já pode resgatar outra recompensa.'
                    : `Próximo lucro disponível em ${formatDuration(cooldownSeconds || 0)}.`}
                </span>
              </div>
            </div>
          </section>
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
          {(() => {
            const rewardDistribution = rewards.map((reward) => ({
              value: Number(reward.value),
              weight: Number(reward.weight),
              chance: 0,
            }));

            return rewards.map((reward, index) => {
              const chanceValue = totalWeight > 0 ? (Number(reward.weight) / totalWeight) * 100 : 0;
              const tier = getLucroRewardTier(Number(reward.value), rewardDistribution);

              return (
                <fieldset className="reward-row" data-tier={tier.index} key={reward.key}>
                  <legend>Faixa {String(index + 1).padStart(2, '0')}</legend>
                  <div className="reward-summary">
                    <div>
                      <strong>{tier.name}</strong>
                      <span className="reward-tier">{tier.rarity}</span>
                    </div>
                    <p>{reward.messages.pt || 'Defina a mensagem em português.'}</p>
                  </div>
                  <label className="reward-inline-field">
                    Valor
                    <input
                      min="1"
                      onChange={(event) => updateReward(index, 'value', event.target.value)}
                      required
                      step="1"
                      type="number"
                      value={reward.value}
                    />
                    <span>moedas</span>
                  </label>
                  <label className="reward-inline-field">
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
                  <div className="reward-probability">
                    <div>
                      <output>{chanceValue.toFixed(1)}%</output>
                      <span>de chance</span>
                    </div>
                    <div
                      aria-label={`${chanceValue.toFixed(1)}% de chance`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={chanceValue}
                      className="reward-probability-track"
                      role="progressbar"
                    >
                      <i style={{ width: `${chanceValue}%` }} />
                    </div>
                  </div>
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
            });
          })()}
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
              <h2>Mensagem de sucesso</h2>
            </div>
            <span className="badge">JSON Schema</span>
          </div>
          <div className="embed-editor">
            <div className="embed-fields">
              <div className="embed-fields-intro">
                <p className="eyebrow">Editor de mensagem</p>
                <p>Monte a resposta que o jogador verá ao resgatar o lucro.</p>
              </div>
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
                Mensagem
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
                <div className="variable-palette-intro">
                  <p className="eyebrow">Inserir dados na mensagem</p>
                  <p>Clique para inserir no cursor ou arraste até a posição desejada.</p>
                </div>
                <div className="variable-list">
                  {embedSchema.variables.map((variable) => {
                    const presentation = previewVariablePresentation[variable.token];
                    const label = presentation?.label ?? variable.description;
                    return (
                      <button
                        aria-label={`Inserir ${label}: ${variable.token}`}
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
                        <span aria-hidden="true" className="variable-chip-icon">
                          {presentation?.icon ?? '•'}
                        </span>
                        <span className="variable-chip-label">{label}</span>
                        <code>{variable.token}</code>
                      </button>
                    );
                  })}
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
              <div className="embed-preview-topbar">
                <div>
                  <span className="preview-label">Prévia ao vivo</span>
                  <p>Resposta no Discord</p>
                </div>
                <button
                  className="preview-test-button"
                  disabled={previewTestState === 'thinking'}
                  onClick={testCommand}
                  type="button"
                >
                  <span aria-hidden="true">▶</span>
                  {previewTestState === 'thinking'
                    ? 'Testando…'
                    : previewTestState === 'complete'
                      ? 'Testar novamente'
                      : 'Testar /lucro'}
                </button>
              </div>
              <div className="preview-result-selector">
                <span>Visualizar resultado</span>
                <div
                  aria-label="Resultado simulado"
                  className="preview-result-options"
                  role="group"
                >
                  {previewScenarioOptions.map((scenario) => (
                    <button
                      aria-pressed={previewScenario === scenario.id}
                      className="preview-result-option"
                      key={scenario.id}
                      onClick={() => selectPreviewScenario(scenario.id)}
                      type="button"
                    >
                      {scenario.id === 'random' ? '🎲 ' : null}
                      {scenario.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="preview-stage">
                <div className="preview-command-context">
                  <span aria-hidden="true" className="preview-user-avatar">
                    V
                  </span>
                  <p>
                    <strong>Victor</strong> usou <code>/lucro</code>
                  </p>
                </div>
                {previewTestState === 'thinking' ? (
                  <div aria-live="polite" className="preview-thinking">
                    <span aria-hidden="true" className="preview-bot-avatar">
                      F
                    </span>
                    <p>
                      FutHub está pensando
                      <span aria-hidden="true" className="preview-typing-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                    </p>
                  </div>
                ) : (
                  <div
                    className="preview-message"
                    key={`${previewPulse}-${previewReward?.key ?? 'fallback'}`}
                  >
                    <DiscordMessages>
                      <DiscordMessage author="FutHub" bot>
                        <DiscordEmbed color={embed.color} embedTitle={embed.title} slot="embeds">
                          <DiscordEmbedDescription slot="description">
                            {renderPreview(embed.description, previewValues, highlightedToken)}
                          </DiscordEmbedDescription>
                          {embed.footer ? (
                            <DiscordEmbedFooter slot="footer">{embed.footer}</DiscordEmbedFooter>
                          ) : null}
                        </DiscordEmbed>
                      </DiscordMessage>
                    </DiscordMessages>
                  </div>
                )}
              </div>
              <p aria-live="polite" className="preview-hint">
                {previewTestState === 'complete'
                  ? 'Teste concluído com a faixa selecionada.'
                  : 'A prévia acompanha suas edições em tempo real.'}
              </p>
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
