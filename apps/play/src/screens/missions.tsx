import { listMissions } from '@futhub/api-client';
import { useCallback } from 'react';

import { Loadable, ScreenHeader, type ScreenProps, useLoad } from '../ui';

const cadences = { daily: 'Diárias', weekly: 'Semanais', monthly: 'Mensais' } as const;
const rewards = {
  balance: 'moedas',
  card: 'card',
  field: 'campo',
  pack: 'pack',
  premium: 'premium',
};

export function Missions({ me }: ScreenProps) {
  const missions = useLoad(useCallback(() => listMissions(me), [me]));
  return (
    <>
      <ScreenHeader kicker="MISSÕES" title="Objetivos" />
      <Loadable state={missions}>
        {(data) =>
          data.missions.length ? (
            (Object.keys(cadences) as (keyof typeof cadences)[]).map((cadence) => {
              const items = data.missions.filter((mission) => mission.cadence === cadence);
              if (!items.length) return null;
              return (
                <section className="panel" key={cadence}>
                  <h2>{cadences[cadence]}</h2>
                  <ul className="mission-list">
                    {items.map((mission) => (
                      <li className={mission.completed ? 'is-done' : ''} key={mission.id}>
                        <div>
                          <strong>{mission.title}</strong>
                          <span className="muted">
                            {mission.reward
                              ? `${mission.reward.quantity}× ${rewards[mission.reward.type]} · `
                              : ''}
                            expira {new Date(mission.expiresAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <span className="progress-track is-ready">
                          <i
                            style={{
                              width: `${Math.min(100, (mission.progress / Math.max(1, mission.goal)) * 100)}%`,
                            }}
                          />
                        </span>
                        <span className="mission-count">
                          {mission.completed ? '✓' : `${mission.progress}/${mission.goal}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          ) : (
            <div className="panel empty">Nenhuma missão ativa.</div>
          )
        }
      </Loadable>
    </>
  );
}
