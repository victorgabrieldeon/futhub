import {
  type OpenPackResponse,
  getPackShop,
  getTeam,
  openPack,
  purchasePack,
} from '@futhub/api-client';
import { useCallback, useState } from 'react';

import {
  Emoji,
  Loadable,
  Pager,
  PlayerCard,
  ScreenHeader,
  type ScreenProps,
  coins,
  useAction,
  useLoad,
  withMissions,
} from '../ui';

const teamQuery = {
  collectionId: null,
  name: '',
  page: 1,
  position: null,
  sellable: false,
  sort: 'overall',
} as const;

export function Store({ me, notify, onBalance }: ScreenProps) {
  const [page, setPage] = useState(1);
  const shop = useLoad(useCallback(() => getPackShop({ page }), [page]));
  const owned = useLoad(useCallback(() => getTeam({ ...teamQuery, identity: me }), [me]));
  const { busy, run } = useAction(notify);
  const [opened, setOpened] = useState<OpenPackResponse | null>(null);

  const buy = (packId: string, name: string) =>
    run(async () => {
      const result = await purchasePack(packId, { identity: me });
      onBalance(result.balance);
      void owned.reload();
      notify({
        kind: 'ok',
        text: withMissions(
          `${name} comprado. Você tem ${result.quantity}.`,
          result.completedMissions,
        ),
      });
    });

  const open = (packId: string) =>
    run(async () => {
      const result = await openPack(packId, { identity: me });
      setOpened(result);
      void owned.reload();
      notify({
        kind: 'ok',
        text: withMissions(
          `+${result.progression.gainedXp} XP · nível ${result.progression.level}.`,
          result.completedMissions,
        ),
      });
    });

  return (
    <>
      <ScreenHeader kicker="LOJA" title="Packs" />
      {opened ? (
        <section className="panel reveal" aria-live="polite">
          <header className="panel-header">
            <h2>Cards do pack</h2>
            <button className="ghost-button" onClick={() => setOpened(null)} type="button">
              Fechar
            </button>
          </header>
          <div className="card-grid">
            {opened.cards.map(({ id, card }, index) => (
              <div className="reveal-card" key={id} style={{ animationDelay: `${index * 120}ms` }}>
                <PlayerCard card={card} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <Loadable state={owned}>
        {(team) =>
          team.packs.length ? (
            <section className="panel">
              <h2>Seus packs</h2>
              <div className="pack-grid">
                {team.packs.map((pack) => (
                  <article className="pack-tile" key={pack.id}>
                    {pack.imageUrl ? <img alt="" src={pack.imageUrl} /> : null}
                    <strong>
                      <Emoji value={pack.emoji} /> {pack.name}
                    </strong>
                    <span>
                      {pack.quantity}× · {pack.cardsAmount} cards
                    </span>
                    <button
                      className="play-button"
                      disabled={busy}
                      onClick={() => void open(pack.id)}
                      type="button"
                    >
                      Abrir
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null
        }
      </Loadable>
      <Loadable state={shop}>
        {(data) => (
          <section className="panel">
            <h2>À venda</h2>
            {data.packs.length ? (
              <div className="pack-grid">
                {data.packs.map((pack) => (
                  <article className="pack-tile" key={pack.id}>
                    {pack.imageUrl ? <img alt="" src={pack.imageUrl} /> : null}
                    <strong>
                      <Emoji value={pack.emoji} /> {pack.name}
                    </strong>
                    <span>{pack.cardsPerPack} cards</span>
                    <button
                      className="play-button"
                      disabled={busy}
                      onClick={() => void buy(pack.id, pack.name)}
                      type="button"
                    >
                      Comprar {coins(pack.price)}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">Nenhum pack à venda agora.</p>
            )}
            <Pager onPage={setPage} page={data.page} totalPages={data.totalPages} />
          </section>
        )}
      </Loadable>
    </>
  );
}
