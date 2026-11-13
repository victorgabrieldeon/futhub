import {
  type ListCardMarketParams,
  type ListCardMarketPositionsItem,
  type ListCardMarketSort,
  TeamCardPosition,
  listCardMarket,
  listCardMarketCatalog,
  purchaseCard,
} from '@futhub/api-client';
import { useCallback, useState } from 'react';

import {
  Loadable,
  Pager,
  PlayerCard,
  ScreenHeader,
  type ScreenProps,
  coins,
  emojiText,
  useAction,
  useLoad,
  withMissions,
} from '../ui';

const sorts = { overall: 'Overall', name: 'Nome', recent: 'Recentes' } as const;

export function Market({ me, notify, onBalance }: ScreenProps) {
  const [params, setParams] = useState<ListCardMarketParams>({
    maxOverall: 99,
    minOverall: 1,
    page: 1,
    sort: 'overall',
  });
  const catalog = useLoad(listCardMarketCatalog);
  const market = useLoad(useCallback(() => listCardMarket(params), [params]));
  const { busy, run } = useAction(notify);
  const filter = (patch: Partial<ListCardMarketParams>) =>
    setParams((current) => ({ ...current, page: 1, ...patch }));

  const buy = (cardId: string, name: string) =>
    run(async () => {
      const result = await purchaseCard(cardId, { identity: me });
      onBalance(result.balance);
      notify({
        kind: 'ok',
        text: withMissions(
          `${name} contratado por ${coins(result.price)}.`,
          result.completedMissions,
        ),
      });
    });

  return (
    <>
      <ScreenHeader kicker="MERCADO" title="Contratações" />
      <section className="panel">
        <div className="filters">
          <select
            aria-label="Posição"
            onChange={(event) =>
              filter({
                positions: event.target.value
                  ? [event.target.value as ListCardMarketPositionsItem]
                  : undefined,
              })
            }
            value={params.positions?.[0] ?? ''}
          >
            <option value="">Todas posições</option>
            {Object.values(TeamCardPosition).map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
          <Loadable state={catalog}>
            {(data) => (
              <>
                <select
                  aria-label="Clube"
                  onChange={(event) => filter({ teamId: event.target.value || undefined })}
                  value={params.teamId ?? ''}
                >
                  <option value="">Todos clubes</option>
                  {data.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {emojiText(team.emoji)} {team.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Coleção"
                  onChange={(event) => filter({ collectionId: event.target.value || undefined })}
                  value={params.collectionId ?? ''}
                >
                  <option value="">Todas coleções</option>
                  {data.collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {emojiText(collection.emoji)} {collection.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </Loadable>
          <label className="inline-field">
            OVR mín.
            <input
              max={99}
              min={1}
              onChange={(event) => filter({ minOverall: Number(event.target.value) || 1 })}
              type="number"
              value={params.minOverall}
            />
          </label>
          <select
            aria-label="Ordenar"
            onChange={(event) => filter({ sort: event.target.value as ListCardMarketSort })}
            value={params.sort}
          >
            {Object.entries(sorts).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>
      <Loadable state={market}>
        {(data) => (
          <section className="panel">
            {data.items.length ? (
              <div className="card-grid">
                {data.items.map((card) => (
                  <PlayerCard card={card} key={card.id}>
                    <button
                      disabled={busy}
                      onClick={() => void buy(card.id, card.name)}
                      type="button"
                    >
                      {coins(card.price)}
                    </button>
                  </PlayerCard>
                ))}
              </div>
            ) : (
              <p className="muted">Nenhum card com esses filtros.</p>
            )}
            <Pager
              onPage={(page) => setParams((current) => ({ ...current, page }))}
              page={data.page}
              totalPages={data.totalPages}
            />
          </section>
        )}
      </Loadable>
    </>
  );
}
