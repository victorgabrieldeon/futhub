import type { Canvas } from 'fabric';
import { useState } from 'react';
import { PackCanvas } from './pack-canvas';
import type { PackStudioDraft } from './pack-studio-model';

const contexts = [
  { id: 'editor', label: 'Edição' },
  { id: 'store', label: 'Loja' },
  { id: 'thumbnail', label: 'Miniatura' },
] as const;

export function PackStudioPreview({
  draft,
  onCanvasReady,
}: Readonly<{
  draft: PackStudioDraft;
  onCanvasReady: (canvas: Canvas | null) => void;
}>) {
  const [context, setContext] = useState<(typeof contexts)[number]['id']>('editor');
  const [zoom, setZoom] = useState(100);
  return (
    <main className={`pack-studio-canvas-region pack-studio-preview--${context}`}>
      <div className="pack-studio-canvas-toolbar">
        <div aria-label="Contexto da prévia" className="pack-studio-preview-contexts">
          {contexts.map(({ id, label }) => (
            <button
              aria-pressed={context === id}
              key={id}
              onClick={() => setContext(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        {context === 'editor' && (
          <div className="pack-studio-zoom" aria-label="Zoom do canvas">
            <button
              aria-label="Diminuir zoom"
              disabled={zoom === 75}
              onClick={() => setZoom((value) => Math.max(75, value - 25))}
              type="button"
            >
              −
            </button>
            <output>{zoom}%</output>
            <button
              aria-label="Aumentar zoom"
              disabled={zoom === 125}
              onClick={() => setZoom((value) => Math.min(125, value + 25))}
              type="button"
            >
              +
            </button>
            <button onClick={() => setZoom(100)} type="button">
              Ajustar
            </button>
          </div>
        )}
      </div>
      <div className={`pack-studio-stage pack-studio-stage--${context === 'editor' ? zoom : 100}`}>
        <div className="pack-studio-preview-card">
          <PackCanvas draft={draft} onCanvasReady={onCanvasReady} />
          <div className="pack-studio-preview-details" hidden={context === 'editor'}>
            <p className="eyebrow">{context === 'store' ? 'Pack de cartas' : '96 × 128 px'}</p>
            <h2>{draft.name || 'Novo pack'}</h2>
            <p>
              {draft.cardsAmount} {draft.cardsAmount === 1 ? 'carta' : 'cartas'}
            </p>
            <strong>{draft.price.toLocaleString('pt-BR')} moedas</strong>
          </div>
        </div>
      </div>
      <p className="pack-studio-preview-caption">
        {context === 'editor'
          ? 'Arte 600 × 800 · fundo transparente na exportação'
          : context === 'store'
            ? 'Simulação de vitrine · sem compra real'
            : 'Simulação em tamanho reduzido · confira contraste e leitura'}
      </p>
    </main>
  );
}
