import {
  type GetTeamBodyPosition,
  type GetTeamBodySort,
  type TeamCard,
  TeamCardPosition,
  type TeamResponse,
  autoSelectTeamLineup,
  getTeam,
  sellCards,
  setTeamCaptain,
  setTeamFormation,
  setTeamLineupCard,
  setTeamTactic,
  toggleTeamCardFavorite,
} from '@futhub/api-client';
import { useCallback, useState } from 'react';

import {
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

const tactics = { balanced: 'Equilibrada', defensive: 'Defensiva', offensive: 'Ofensiva' } as const;
const sorts = { overall: 'Overall', name: 'Nome', recent: 'Recentes' } as const;

type Filters = Readonly<{
  name: string;
  page: number;
  position: GetTeamBodyPosition;
  sellable: boolean;
  sort: GetTeamBodySort;
}>;

export function Team({ me, notify, onBalance }: ScreenProps) {
  const [filters, setFilters] = useState<Filters>({
    name: '',
    page: 1,
    position: null,
    sellable: false,
    sort: 'overall',
  });
  const team = useLoad(
    useCallback(() => getTeam({ ...filters, collectionId: null, identity: me }), [filters, me]),
  );
  const { busy, run } = useAction(notify);
  const [slotPosition, setSlotPosition] = useState<TeamCard['position'] | null>(null);
  const [selling, setSelling] = useState<ReadonlySet<string>>(new Set());

  const filter = (patch: Partial<Filters>) => {
    setSelling(new Set());
    setFilters((current) => ({ ...current, page: 1, ...patch }));
  };
  const act = (action: () => Promise<unknown>, text: string) =>
    run(async () => {
      await action();
      await team.reload();
      notify({ kind: 'ok', text });
    });

  const pickSlot = (position: TeamCard['position']) => {
    setSlotPosition(position);
    filter({ position, sellable: false });
  };
  const place = (card: TeamCard) => {
    if (!slotPosition) return;
    void act(
      () =>
        setTeamLineupCard({ identity: me, position: slotPosition, userCardId: card.userCardId }),
      `${card.name} escalado como ${slotPosition}.`,
    ).then(() => setSlotPosition(null));
  };
  const sell = (data: TeamResponse) =>
    run(async () => {
      const result = await sellCards({ identity: me, userCardIds: [...selling] });
      onBalance(result.balance);
      setSelling(new Set());
      await team.reload();
      notify({
        kind: 'ok',
        text: withMissions(
          `${result.userCardIds.length} cards vendidos por ${coins(result.amount)}.`,
          result.completedMissions,
        ),
      });
      if (data.inventory.items.length === result.userCardIds.length && filters.page > 1)
        filter({ page: filters.page - 1 });
    });

  return (
    <>
      <ScreenHeader kicker="ELENCO" title="Seu time" />
      <Loadable state={team}>
        {(data) => (
          <>
            <section className="panel team-controls">
              <div className="team-stats">
                <span>
                  Força <strong>{data.strength}</strong>
                </span>
                <span>
                  Nível <strong>{data.profile.level}</strong> · {data.profile.xp}/
                  {data.profile.nextLevelXp} XP
                </span>
                <span>
                  Cards <strong>{data.inventoryCount}</strong>
                </span>
              </div>
              <label>
                Formação
                <select
                  disabled={busy}
                  onChange={(event) =>
                    void act(
                      () => setTeamFormation({ formationId: event.target.value, identity: me }),
                      'Formação atualizada.',
                    )
                  }
                  value={data.formation.id}
                >
                  {data.formations.map((formation) => (
                    <option key={formation.id} value={formation.id}>
                      {formation.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tática
                <select
                  disabled={busy}
                  onChange={(event) =>
                    void act(
                      () =>
                        setTeamTactic({
                          identity: me,
                          tactic: event.target.value as keyof typeof tactics,
                        }),
                      'Tática atualizada.',
                    )
                  }
                  value={data.tactic}
                >
                  {Object.entries(tactics).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="ghost-button"
                disabled={busy}
                onClick={() =>
                  void act(
                    () => autoSelectTeamLineup({ identity: me }),
                    'Time escalado automaticamente.',
                  )
                }
                type="button"
              >
                Escalar automático
              </button>
            </section>

            <section className="panel">
              <h2>Titulares</h2>
              <p className="muted">Toque numa vaga para escolher quem joga nela.</p>
              <Pitch
                data={data}
                onCaptain={(card) =>
                  void act(
                    () => setTeamCaptain({ identity: me, userCardId: card.userCardId }),
                    `${card.name} agora é capitão.`,
                  )
                }
                onSlot={pickSlot}
                selected={slotPosition}
              />
            </section>

            <section className="panel">
              <header className="panel-header">
                <h2>
                  {slotPosition
                    ? `Escolha um ${slotPosition}`
                    : filters.sellable
                      ? 'Vender cards'
                      : 'Inventário'}
                </h2>
                <div className="toolbar">
                  {slotPosition ? (
                    <button
                      className="ghost-button"
                      onClick={() => setSlotPosition(null)}
                      type="button"
                    >
                      Cancelar
                    </button>
                  ) : (
                    <button
                      aria-pressed={filters.sellable}
                      className="ghost-button"
                      onClick={() => filter({ sellable: !filters.sellable })}
                      type="button"
                    >
                      {filters.sellable ? 'Sair da venda' : 'Modo venda'}
                    </button>
                  )}
                </div>
              </header>
              <div className="filters">
                <input
                  aria-label="Buscar por nome"
                  maxLength={80}
                  onChange={(event) => filter({ name: event.target.value })}
                  placeholder="Buscar jogador"
                  value={filters.name}
                />
                <select
                  aria-label="Posição"
                  onChange={(event) =>
                    filter({ position: (event.target.value || null) as GetTeamBodyPosition })
                  }
                  value={filters.position ?? ''}
                >
                  <option value="">Todas posições</option>
                  {Object.values(TeamCardPosition).map((position) => (
                    <option key={position} value={position}>
                      {position}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Ordenar"
                  onChange={(event) => filter({ sort: event.target.value as GetTeamBodySort })}
                  value={filters.sort}
                >
                  {Object.entries(sorts).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {data.inventory.items.length ? (
                <div className="card-grid">
                  {data.inventory.items.map((card) => (
                    <PlayerCard
                      card={card}
                      key={card.userCardId}
                      onSelect={
                        filters.sellable
                          ? () =>
                              setSelling((current) => {
                                const next = new Set(current);
                                if (!next.delete(card.userCardId)) next.add(card.userCardId);
                                return next;
                              })
                          : undefined
                      }
                      selected={selling.has(card.userCardId)}
                    >
                      {filters.sellable ? (
                        <span className="muted">{coins(card.sellPrice)}</span>
                      ) : (
                        <>
                          {slotPosition ? (
                            <button disabled={busy} onClick={() => place(card)} type="button">
                              Escalar
                            </button>
                          ) : card.holder ? (
                            <span className="badge">Titular</span>
                          ) : null}
                          <button
                            aria-label={card.favorite ? 'Desfavoritar' : 'Favoritar'}
                            aria-pressed={card.favorite}
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () => toggleTeamCardFavorite(card.userCardId, { identity: me }),
                                card.favorite ? 'Removido dos favoritos.' : 'Favoritado.',
                              )
                            }
                            type="button"
                          >
                            {card.favorite ? '★' : '☆'}
                          </button>
                        </>
                      )}
                    </PlayerCard>
                  ))}
                </div>
              ) : (
                <p className="muted">Nenhum card encontrado.</p>
              )}
              <Pager
                onPage={(page) => setFilters((current) => ({ ...current, page }))}
                page={data.inventory.page}
                totalPages={data.inventory.totalPages}
              />
              {filters.sellable && selling.size ? (
                <div className="sell-bar">
                  <span>
                    {selling.size} selecionados ·{' '}
                    {coins(
                      data.inventory.items
                        .filter(({ userCardId }) => selling.has(userCardId))
                        .reduce((total, card) => total + card.sellPrice, 0),
                    )}
                  </span>
                  <button
                    className="play-button"
                    disabled={busy}
                    onClick={() => void sell(data)}
                    type="button"
                  >
                    Vender
                  </button>
                </div>
              ) : null}
            </section>
          </>
        )}
      </Loadable>
    </>
  );
}

function Pitch({
  data,
  onCaptain,
  onSlot,
  selected,
}: Readonly<{
  data: TeamResponse;
  onCaptain: (card: TeamCard) => void;
  onSlot: (position: TeamCard['position']) => void;
  selected: TeamCard['position'] | null;
}>) {
  // Mesma distribuição do bot: cada titular ocupa a primeira vaga livre da sua posição.
  const remaining = [...data.lineup];
  const placed = data.formation.slots.map((slot) => {
    const index = remaining.findIndex(({ holderPosition }) => holderPosition === slot.position);
    return { card: index >= 0 ? remaining.splice(index, 1)[0] : undefined, slot };
  });
  return (
    <div className="team-pitch">
      {placed.map(({ card, slot }) => (
        <div className="pitch-slot" key={slot.id} style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
          <button
            className={`slot-button${selected === slot.position ? ' is-selected' : ''}`}
            onClick={() => onSlot(slot.position)}
            type="button"
          >
            <span className="slot-overall">{card ? card.overall : '+'}</span>
            <span className="slot-name">{card ? card.name : 'Vaga'}</span>
            <span className="slot-position">
              {slot.position}
              {card?.captain ? ' · C' : ''}
            </span>
          </button>
          {card && !card.captain ? (
            <button
              aria-label={`Tornar ${card.name} capitão`}
              className="captain-button"
              onClick={() => onCaptain(card)}
              type="button"
            >
              C
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
