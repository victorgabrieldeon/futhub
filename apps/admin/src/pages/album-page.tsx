import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type Card,
  type Catalog,
  type Page,
  getCatalog,
  listCards,
} from '../features/cards/actions';

type AlbumState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; cards: Page<Card>; catalog: Catalog };

export function AlbumPage() {
  const [state, setState] = useState<AlbumState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (state.status !== 'loading') return;
    let active = true;
    void Promise.all([listCards(1, 8, { sort: 'recent' }), getCatalog()])
      .then(([cards, catalog]) => {
        if (active) setState({ status: 'ready', cards, catalog });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [state.status]);

  const cards = state.status === 'ready' ? state.cards.items : [];
  const featured = cards.find((card) => card.id === selectedId) ?? cards[0];
  const collections = state.status === 'ready' ? state.catalog.collections : [];
  const visibleCards = cards.filter((card) =>
    `${card.name} ${card.team.name} ${card.position}`
      .toLocaleLowerCase('pt-BR')
      .includes(query.trim().toLocaleLowerCase('pt-BR')),
  );

  return (
    <section className="album-page" aria-labelledby="album-title">
      <div className="album-kicker">
        <span>O ACERVO FUT H U B</span>
        <span>CURADORIA DO JOGO / 01</span>
      </div>
      <section className="album-cover" aria-label="Capa do acervo">
        <div className="album-manifesto">
          <p className="album-label">
            <span className="album-live-dot" /> MUITO ALÉM DAS QUATRO LINHAS
          </p>
          <h1 id="album-title">
            O jogo passa.
            <br />A coleção <em>fica.</em>
          </h1>
          <p className="album-intro">
            Talento que vira história.
            <br />
            História que merece um lugar no seu acervo.
          </p>
          <Link className="album-action" to="/app/gerenciar/jogadores">
            Explorar cards <span aria-hidden="true">↗</span>
          </Link>
          <div className="album-catalog-note">
            <span className="album-note-mark" aria-hidden="true">
              FH /
            </span>
            <p>
              Cada atleta, uma identidade.
              <br />
              Cada coleção, um novo capítulo.
            </p>
          </div>
        </div>
        {featured ? (
          <div className="album-athlete" key={featured.id}>
            <div className="album-pitch" aria-hidden="true" />
            <div className="album-overall">
              <strong>{featured.overall}</strong>
              <span>OVR / {featured.position}</span>
            </div>
            <span className="album-athlete-edition">{featured.collection.name}</span>
            <img
              className="album-portrait"
              src={featured.imageUrl}
              alt={featured.name}
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
            <div className="album-athlete-caption" aria-live="polite" aria-atomic="true">
              <p className="album-label">
                EM FOCO <span>/ {featured.team.name}</span>
              </p>
              <h2>{featured.name}</h2>
              <div className="album-athlete-bottom">
                <dl>
                  {[
                    ['ATA', featured.attack],
                    ['DEF', featured.defense],
                    ['CRI', featured.creation],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <Link
                  to="/app/gerenciar/jogadores"
                  state={{ filters: { query: featured.name, sort: 'recent' } }}
                  aria-label={`Explorar card de ${featured.name}`}
                >
                  Ver card <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="album-cover-state">
            <div className="album-pitch" aria-hidden="true" />
            <span className="album-empty-number" aria-hidden="true">
              FH
            </span>
            {state.status === 'loading' ? (
              <output>Preparando o acervo…</output>
            ) : state.status === 'error' ? (
              <div role="alert">
                <h2>O acervo não respondeu.</h2>
                <p>Não foi possível carregar os cards. Tente novamente.</p>
                <button
                  className="album-action"
                  type="button"
                  onClick={() => setState({ status: 'loading' })}
                >
                  Tentar novamente
                </button>
              </div>
            ) : (
              <div>
                <h2>
                  Toda história tem
                  <br />
                  um primeiro nome.
                </h2>
                <p>Cadastre o primeiro card e dê início à coleção.</p>
                <Link className="album-action" to="/app/gerenciar/cards">
                  Criar primeiro card <span aria-hidden="true">↗</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {cards.length > 0 && (
        <fieldset className="album-lineup" aria-label="Escolher atleta em destaque">
          <span className="album-lineup-label">
            NA CAPA <span>ESCOLHA UM NOME</span>
          </span>
          {cards.slice(0, 4).map((card, index) => (
            <button
              key={card.id}
              type="button"
              aria-pressed={featured?.id === card.id}
              onClick={() => setSelectedId(card.id)}
            >
              <span className="album-lineup-index">0{index + 1}</span>
              <span>
                <strong>{card.name}</strong>
                <small>
                  {card.position} · {card.team.name}
                </small>
              </span>
              <b>{card.overall}</b>
            </button>
          ))}
        </fieldset>
      )}

      <div className="album-volume">
        <span>ACERVO VIVO</span>
        <span>
          {state.status === 'ready'
            ? `${state.cards.total} cards / ${collections.length} coleções / ${state.catalog.teams.length} times`
            : 'Cards, coleções e times'}
        </span>
        <span aria-hidden="true">F / H</span>
      </div>

      <div className="album-index">
        <section className="album-discovery" aria-labelledby="album-discovery-title">
          <header className="album-section-heading">
            <div>
              <p className="album-label">01 / DESCOBERTA</p>
              <h2 id="album-discovery-title">Entraram para a história.</h2>
            </div>
            <Link to="/app/gerenciar/jogadores">
              Todo o acervo <span aria-hidden="true">↗</span>
            </Link>
          </header>
          {state.status === 'ready' && cards.length > 0 && (
            <>
              <label className="album-search">
                <span>Buscar nos 8 mais recentes</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nome, time ou posição"
                />
              </label>
              <div className="album-recent-list">
                {visibleCards.slice(0, 4).map((card) => (
                  <Link
                    key={card.id}
                    className="album-recent-player"
                    to="/app/gerenciar/jogadores"
                    state={{ filters: { query: card.name, sort: 'recent' } }}
                  >
                    <div className="album-recent-art">
                      <span aria-hidden="true">{card.overall}</span>
                      <img
                        src={card.imageUrl}
                        alt=""
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                        }}
                      />
                    </div>
                    <div>
                      <span className="album-label">
                        {card.position} / {card.collection.name}
                      </span>
                      <h3>{card.name}</h3>
                      <p>{card.team.name}</p>
                    </div>
                    <span className="album-recent-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </Link>
                ))}
                {visibleCards.length === 0 && (
                  <output>
                    Nenhum card recente corresponde à busca.{' '}
                    <button type="button" onClick={() => setQuery('')}>
                      Limpar busca
                    </button>
                  </output>
                )}
              </div>
            </>
          )}
          {state.status !== 'ready' && (
            <p className="album-muted">
              {state.status === 'loading'
                ? 'Carregando novos nomes…'
                : 'Acervo indisponível. Use “Tentar novamente” na capa.'}
            </p>
          )}
          {state.status === 'ready' && cards.length === 0 && (
            <p className="album-muted">Os próximos nomes do FutHub começam com sua curadoria.</p>
          )}
        </section>
        <aside className="album-collections" aria-labelledby="album-collections-title">
          <p className="album-label">02 / EDIÇÕES</p>
          <h2 id="album-collections-title">
            Não são só cards.
            <br />
            <em>São coleções.</em>
          </h2>
          <div className="album-collection-list">
            {collections.slice(0, 4).map((collection, index) => (
              <Link
                key={collection.id}
                to="/app/gerenciar/jogadores"
                state={{ filters: { collectionId: collection.id, sort: 'recent' } }}
              >
                <span>0{index + 1}</span>
                <strong>{collection.name}</strong>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
          <Link className="album-text-link" to="/app/gerenciar/colecoes">
            Gerenciar coleções <span aria-hidden="true">↗</span>
          </Link>
          <div className="album-studio-note">
            <span className="album-label">DO CONCEITO AO CARD</span>
            <h3>
              Dê forma
              <br />
              ao próximo ídolo.
            </h3>
            <Link to="/app/studio">
              Entrar no Studio <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </aside>
      </div>
      <section className="album-pack-note" aria-labelledby="album-packs-title">
        <span className="album-label">03 / PACKS</span>
        <h2 id="album-packs-title">
          A expectativa também
          <br />
          faz parte do jogo.
        </h2>
        <div>
          <p>
            Escolha quem pode chegar.
            <br />
            Configure packs, preços e probabilidades.
          </p>
          <Link className="album-action" to="/app/gerenciar/packs">
            Gerenciar packs <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <footer className="album-footer">
        <strong>FutHub</strong>
        <span>O FUTEBOL FICA COM VOCÊ.</span>
        <Link to="/app/comandos">Ir para operação ↗</Link>
      </footer>
    </section>
  );
}
