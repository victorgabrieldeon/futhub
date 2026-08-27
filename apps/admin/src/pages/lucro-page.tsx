import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiClientError, getV1AdminLucro, getV1AdminLucroSchema } from '@futhub/api-client';
import { adminApiOptions } from '../api/admin-client';
import { LucroForm } from '../features/lucro-form';
import {
  analyzeLucroEconomy,
  getLucroRewardTier,
  hasHighEconomyImpact,
  rollLucroReward,
} from '../lib/lucro-economy';
import type { LucroDistributionReward, LucroEconomyInput } from '../lib/lucro-economy';
import type { LucroConfig, LucroEmbedSchema } from '../lib/lucro';

type LucroData = Readonly<{ config: LucroConfig; embedSchema: LucroEmbedSchema }>;
type SimulationResult = Readonly<{
  id: number;
  chance: number;
  rarity: string;
  value: number;
}>;

const coinFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

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

function formatCoins(value: number): string {
  return coinFormatter.format(value);
}

export function LucroPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<LucroData | null>(null);
  const [economyInput, setEconomyInput] = useState<LucroEconomyInput | null>(null);
  const [simulationHistory, setSimulationHistory] = useState<readonly SimulationResult[]>([]);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewardsSelected, setRewardsSelected] = useState(false);
  const rollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getV1AdminLucro(adminApiOptions()), getV1AdminLucroSchema(adminApiOptions())])
      .then(([config, embedSchema]) => {
        if (!active) return;
        const lucroConfig = config as LucroConfig;
        setData({ config: lucroConfig, embedSchema: embedSchema as LucroEmbedSchema });
        setEconomyInput(lucroConfig);
      })
      .catch((cause) => {
        if (cause instanceof ApiClientError && cause.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        if (active) setError('Não foi possível carregar a configuração.');
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(
    () => () => {
      if (rollTimeoutRef.current !== null) window.clearTimeout(rollTimeoutRef.current);
    },
    [],
  );

  const updateEconomyPreview = useCallback((economy: LucroEconomyInput) => {
    setEconomyInput(economy);
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!data) return null;

  const { config, embedSchema } = data;
  const economy = analyzeLucroEconomy(economyInput ?? config);
  const highEconomyImpact = hasHighEconomyImpact(economy);
  const latestSimulation = simulationHistory[0];

  function simulateReward(): void {
    if (rolling || economy.distribution.length === 0) return;

    setRolling(true);
    rollTimeoutRef.current = window.setTimeout(() => {
      const reward = rollLucroReward(economy.distribution);
      if (reward) {
        const tier = getLucroRewardTier(reward.value, economy.distribution);
        const result: SimulationResult = {
          id: Date.now(),
          chance: reward.chance,
          rarity: tier.rarity,
          value: reward.value,
        };
        setSimulationHistory((current) => [result, ...current].slice(0, 5));
      }
      setRolling(false);
      rollTimeoutRef.current = null;
    }, 420);
  }

  function distributionLabel(reward: LucroDistributionReward): string {
    const tier = getLucroRewardTier(reward.value, economy.distribution);
    return `${tier.name}: ${formatCoins(reward.value)} moedas, ${reward.chance.toFixed(1)}% de chance`;
  }

  const riskExplanation =
    economy.highestReward &&
    economy.highestReward.value >= 500 &&
    economy.highestReward.chance >= 50
      ? `${formatCoins(economy.highestReward.value)} moedas aparecem em ${economy.highestReward.chance.toFixed(1)}% dos resgates.`
      : `Média de ${formatCoins(economy.averageReward)} moedas com uso a cada ${formatDuration(economy.cooldownSeconds ?? 0)}.`;

  return (
    <section className="command-page lucro-page" aria-labelledby="command-title">
      <header className="command-header">
        <div>
          <p className="eyebrow">Economia · comando</p>
          <h1 id="command-title">/lucro</h1>
          <p>Construa a distribuição, teste a recompensa e acompanhe o impacto da economia.</p>
        </div>
        <div className="header-metrics" aria-label="Resumo da configuração">
          <div>
            <span>Cooldown</span>
            <strong>{formatDuration(economy.cooldownSeconds ?? config.cooldownSeconds)}</strong>
          </div>
          <div>
            <span>Faixas</span>
            <strong>{economy.distribution.length}</strong>
          </div>
        </div>
      </header>
      <div
        className={`command-content-grid${rewardsSelected ? '' : ' command-content-grid--single'}`}
      >
        <LucroForm
          config={config}
          embedSchema={embedSchema}
          onEconomyChange={updateEconomyPreview}
          onRewardsTabChange={setRewardsSelected}
          onSaved={(saved) => {
            setData((current) => (current ? { ...current, config: saved } : current));
            setEconomyInput(saved);
          }}
        />
        {rewardsSelected ? (
          <aside className="economy-panel" aria-label="Distribuição e impacto da economia">
            <section className="economy-overview" aria-labelledby="distribution-title">
              <div>
                <p className="eyebrow">Distribuição ao vivo</p>
                <h2 id="distribution-title">Cada peso muda a chance</h2>
              </div>
              <p className="economy-average">
                <span>Valor médio por resgate</span>
                <strong>{formatCoins(economy.averageReward)} moedas</strong>
              </p>
              {economy.distribution.length ? (
                <ul className="distribution-list">
                  {economy.distribution.map((reward, index) => {
                    const tier = getLucroRewardTier(reward.value, economy.distribution);
                    return (
                      <li data-tier={tier.index} key={`${reward.value}-${reward.weight}-${index}`}>
                        <div>
                          <span>
                            {formatCoins(reward.value)} moedas <small>{tier.rarity}</small>
                          </span>
                          <b>{reward.chance.toFixed(1)}%</b>
                        </div>
                        <div
                          aria-label={distributionLabel(reward)}
                          aria-valuemax={100}
                          aria-valuemin={0}
                          aria-valuenow={reward.chance}
                          className="distribution-track"
                          role="progressbar"
                        >
                          <i style={{ width: `${reward.chance}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="distribution-empty">
                  Informe valores e pesos positivos para visualizar a distribuição.
                </p>
              )}
            </section>

            <section className="economy-impact" aria-labelledby="impact-title">
              <p className="eyebrow" id="impact-title">
                Impacto estimado
              </p>
              <dl>
                <div>
                  <dt>A cada 100 resgates</dt>
                  <dd>{formatCoins(economy.averageReward * 100)} moedas</dd>
                </div>
                <div>
                  <dt>Faixa de recompensa</dt>
                  <dd>
                    {economy.lowestReward
                      ? `${formatCoins(economy.lowestReward.value)}–${formatCoins(economy.highestReward?.value ?? 0)}`
                      : '—'}{' '}
                    moedas
                  </dd>
                </div>
                <div>
                  <dt>Maior recompensa</dt>
                  <dd>
                    {economy.highestReward
                      ? `${formatCoins(economy.highestReward.value)} · ${economy.highestReward.chance.toFixed(1)}%`
                      : '—'}
                  </dd>
                </div>
              </dl>
            </section>

            {highEconomyImpact ? (
              <p className="economy-alert" role="status">
                <strong>Impacto alto na economia</strong>
                <span>{riskExplanation}</span>
              </p>
            ) : null}

            <section className="reward-simulator" aria-labelledby="simulator-title">
              <div className="simulator-heading">
                <div>
                  <p className="eyebrow">Preview de sorte</p>
                  <h2 id="simulator-title">Simular recompensa</h2>
                </div>
                <button
                  className="simulation-button"
                  disabled={rolling || economy.distribution.length === 0}
                  onClick={simulateReward}
                  type="button"
                >
                  {rolling ? 'Sorteando…' : 'Rolar agora'}
                </button>
              </div>
              <div
                aria-live="polite"
                className={`simulation-result${rolling ? ' is-rolling' : ''}`}
              >
                {rolling ? (
                  <span>Calculando a recompensa…</span>
                ) : latestSimulation ? (
                  <>
                    <span>Última simulação</span>
                    <strong>+{formatCoins(latestSimulation.value)} moedas</strong>
                    <small>
                      {latestSimulation.rarity} · {latestSimulation.chance.toFixed(1)}% de chance
                    </small>
                  </>
                ) : (
                  <span>Rode para testar a distribuição atual.</span>
                )}
              </div>
              {simulationHistory.length > 1 ? (
                <ol className="simulation-history" aria-label="Últimas cinco simulações">
                  {simulationHistory.slice(1).map((result) => (
                    <li key={result.id}>
                      <span>{result.rarity}</span>
                      <strong>+{formatCoins(result.value)}</strong>
                    </li>
                  ))}
                </ol>
              ) : null}
              <p className="analysis-note">
                Prévia usa alterações não salvas e não distribui moedas.
              </p>
            </section>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
