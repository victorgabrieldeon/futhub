import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { getLucroCommandContract, getLucroConfig } from '../../../lib/backend';
import type { LucroCommandContract, LucroConfig } from '../../../lib/lucro';
import { LucroForm } from '../lucro-form';

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

export default async function CommandPage({
  params,
}: Readonly<{ params: Promise<{ command: string }> }>) {
  const { command } = await params;
  if (command !== 'lucro') notFound();

  const apiKey = (await cookies()).get('admin_api_key')?.value;
  if (!apiKey) redirect('/login');

  let config: LucroConfig;
  let contract: LucroCommandContract;
  try {
    [config, contract] = await Promise.all([
      getLucroConfig(apiKey),
      getLucroCommandContract(apiKey),
    ]);
  } catch {
    redirect('/login');
  }

  const totalWeight = config.rewards.reduce((total, reward) => total + reward.weight, 0);
  const expectedValue = config.rewards.reduce(
    (total, reward) => total + reward.value * reward.weight,
    0,
  );
  const lowestReward = Math.min(...config.rewards.map((reward) => reward.value));
  const highestReward = Math.max(...config.rewards.map((reward) => reward.value));

  return (
    <section className="command-page" aria-labelledby="command-title">
      <header className="command-header">
        <div>
          <p className="eyebrow">Economia · comando</p>
          <h1 id="command-title">/lucro</h1>
          <p>Configure tempo de espera, distribuição das recompensas e resposta do bot.</p>
        </div>
        <div className="header-metrics" aria-label="Resumo da configuração">
          <div>
            <span>Cooldown</span>
            <strong>{formatDuration(config.cooldownSeconds)}</strong>
          </div>
          <div>
            <span>Faixas</span>
            <strong>{config.rewards.length}</strong>
          </div>
        </div>
      </header>

      <div className="command-content-grid">
        <LucroForm config={config} embedSchema={contract.data} />
        <aside className="analysis-panel" aria-label="Leitura da distribuição">
          <p className="eyebrow">Leitura rápida</p>
          <h2>Distribuição atual</h2>
          <dl>
            <div>
              <dt>Valor médio</dt>
              <dd>{(expectedValue / totalWeight).toFixed(1)} moedas</dd>
            </div>
            <div>
              <dt>Faixa de valor</dt>
              <dd>
                {lowestReward}–{highestReward} moedas
              </dd>
            </div>
            <div>
              <dt>Peso total</dt>
              <dd>{totalWeight}</dd>
            </div>
            <div>
              <dt>Próximo resgate</dt>
              <dd>{formatDuration(config.cooldownSeconds)} após uso</dd>
            </div>
          </dl>
          <p className="analysis-note">
            Chance é relativa ao peso total. Alterações só entram em vigor após salvar.
          </p>
        </aside>
      </div>
    </section>
  );
}
