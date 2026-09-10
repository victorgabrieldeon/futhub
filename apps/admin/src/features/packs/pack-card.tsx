import type { Pack } from './actions';

type PackCardProps = Readonly<{
  onOpen: (pack: Pack) => void;
  pack: Pack;
}>;

function coverBackground(color: string): string {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : 'var(--surface-dark)';
  return `linear-gradient(140deg, ${safeColor}, color-mix(in srgb, ${safeColor} 32%, var(--surface-dark)))`;
}

export function PackCard({ onOpen, pack }: PackCardProps) {
  const status = pack.canBuy ? 'À venda' : 'Pausado';

  return (
    <article
      className={`collection-tile pack-tile${pack.canBuy ? '' : ' is-paused'}`}
      style={{ background: coverBackground(pack.color) }}
    >
      <div className="collection-tile-cover">
        {pack.imageUrl && <img alt="" className="collection-tile-artwork" src={pack.imageUrl} />}
        <div className="collection-tile-cover-content">
          <span aria-hidden="true" className="collection-tile-symbol">
            {pack.emoji}
          </span>
          <div>
            <small className="collection-tile-kind">Oferta</small>
            <strong>{pack.name}</strong>
          </div>
        </div>
        <div className="collection-tile-overlay">
          <span className="collection-tile-contracts">
            <i style={{ backgroundColor: pack.canBuy ? '#fff' : 'transparent' }} />
            {status}
          </span>
          <div className="collection-tile-actions">
            <span className="pack-tile__meta">
              {pack.cardsAmount} cards · {pack.price.toLocaleString('pt-BR')} moedas
            </span>
            <button
              aria-label={`Gerenciar ${pack.name}`}
              className="collection-tile-manage"
              onClick={() => onOpen(pack)}
              type="button"
            >
              Gerenciar <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function PacksEmpty({ onCreate }: Readonly<{ onCreate: () => void }>) {
  return (
    <aside className="collection-gallery-start packs-empty">
      <span aria-hidden="true" className="collection-gallery-start-mark">
        +
      </span>
      <div>
        <h2>Nenhum pack nesta visão</h2>
        <p>Crie um pack para definir oferta, preço e elegibilidade de cards.</p>
      </div>
      <button className="collection-gallery-start-action" onClick={onCreate} type="button">
        Criar primeiro pack
      </button>
    </aside>
  );
}
