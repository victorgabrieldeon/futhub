import {
  type ClubEconomyResponse,
  executeLucro,
  getClub,
  redeemCode,
  upgradeStadium,
} from '@futhub/api-client';
import { type FormEvent, useCallback, useState } from 'react';

import {
  Loadable,
  ScreenHeader,
  type ScreenProps,
  coins,
  useAction,
  useLoad,
  withMissions,
} from '../ui';

const redeemReasons = {
  already_redeemed: 'Você já resgatou este código.',
  exhausted: 'Este código esgotou.',
  expired: 'Este código expirou.',
  inactive: 'Este código está inativo.',
  inventory_full: 'Inventário cheio. Venda cards antes de resgatar.',
  not_found: 'Código não encontrado.',
} as const;

export function Home({ me, notify, onBalance }: ScreenProps) {
  const club = useLoad(useCallback(() => getClub(me), [me]));
  const { busy, run } = useAction(notify);
  const [code, setCode] = useState('');

  const apply = (result: ClubEconomyResponse) => {
    onBalance(result.balance);
    void club.reload();
  };

  const claim = () =>
    run(async () => {
      const result = await executeLucro(me);
      if (result.kind === 'cooldown') {
        const at = new Date(result.availableAt).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        notify({ kind: 'error', text: `Caixa vazio. Volte às ${at}.` });
        return;
      }
      onBalance(result.balance);
      void club.reload();
      notify({
        kind: 'ok',
        text: withMissions(
          `Lucro de ${coins(result.reward.value)} · líquido ${coins(result.report.net)} · +${result.progression.gainedXp} XP.`,
          result.completedMissions,
        ),
      });
    });

  const upgrade = () =>
    run(async () => {
      const result = await upgradeStadium(me);
      apply(result);
      notify({ kind: 'ok', text: `Estádio nível ${result.stadium.level}!` });
    });

  const redeem = (event: FormEvent) => {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    void run(async () => {
      const result = await redeemCode({ identity: me, code: value });
      if (result.kind === 'rejected') {
        notify({ kind: 'error', text: redeemReasons[result.reason] });
        return;
      }
      onBalance(result.balance);
      setCode('');
      const name = result.reward.resourceName ?? result.reward.type;
      notify({ kind: 'ok', text: `Código resgatado: ${result.reward.quantity}× ${name}.` });
    });
  };

  return (
    <>
      <ScreenHeader kicker="CENTRO DE COMANDO" title={`Olá, ${me.name}.`} />
      <section className="dashboard-grid">
        <article className="match-card">
          <p className="kicker">CAIXA DO CLUBE</p>
          <h2>Lucro</h2>
          <p>Bilheteria, patrocínio e comercial caem aqui. Resgate quando o caixa encher.</p>
          <button
            className="play-button"
            disabled={busy}
            onClick={() => void claim()}
            type="button"
          >
            Resgatar lucro <span>→</span>
          </button>
        </article>
        <Loadable state={club}>
          {(data) => (
            <>
              <article className="stat-card">
                <p>ESTÁDIO</p>
                <strong>
                  Nv {data.stadium.level} <small>/ {data.stadium.maxLevel}</small>
                </strong>
                <span>
                  Bilheteria {coins(data.stadium.ticketRevenue)} · Manutenção{' '}
                  {coins(data.stadium.maintenance)}
                </span>
                {data.stadium.nextUpgradeCost !== null ? (
                  <button
                    className="ghost-button"
                    disabled={busy}
                    onClick={() => void upgrade()}
                    type="button"
                  >
                    Evoluir por {coins(data.stadium.nextUpgradeCost)}
                  </button>
                ) : (
                  <span>Nível máximo</span>
                )}
              </article>
              <article className="stat-card">
                <p>PATROCÍNIO</p>
                <strong>{data.sponsor.name}</strong>
                <span>
                  {data.sponsor.weeklyMatches}/{data.sponsor.weeklyGoal} partidas na semana ·{' '}
                  {coins(data.sponsor.payout)}
                </span>
                <span className={`progress-track${data.sponsor.completed ? ' is-ready' : ''}`}>
                  <i
                    style={{
                      width: `${Math.min(100, (data.sponsor.weeklyMatches / Math.max(1, data.sponsor.weeklyGoal)) * 100)}%`,
                    }}
                  />
                </span>
              </article>
              <article className="rank-card">
                <div>
                  <p className="kicker">FINANÇAS</p>
                  <h2>{coins(data.balance)}</h2>
                  <p>
                    Folha {coins(data.payroll)} · Projeção {coins(data.projectedNet)} por lucro
                  </p>
                </div>
              </article>
            </>
          )}
        </Loadable>
      </section>
      <form className="panel redeem-form" onSubmit={redeem}>
        <label htmlFor="redeem-code">Resgatar código</label>
        <input
          autoComplete="off"
          id="redeem-code"
          maxLength={100}
          onChange={(event) => setCode(event.target.value)}
          placeholder="FUTHUB-2026"
          value={code}
        />
        <button className="play-button" disabled={busy || !code.trim()} type="submit">
          Resgatar
        </button>
      </form>
    </>
  );
}
