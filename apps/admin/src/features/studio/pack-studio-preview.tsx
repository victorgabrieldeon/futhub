import type { Canvas } from 'fabric';
import { type CSSProperties, type ReactNode, useState } from 'react';
import { PackCanvas } from './pack-canvas';
import type { PackStudioDraft } from './pack-studio-model';
import { StudioIcon } from './studio-icon';
import { StudioSegmented } from './studio-workspace';

const contexts = [
  { id: 'editor', label: 'Edição' },
  { id: 'store', label: 'Loja' },
  { id: 'thumbnail', label: 'Miniatura' },
] as const;
const zoomLevels = [75, 100, 125] as const;

type PreviewContext = (typeof contexts)[number]['id'];

export function PackStudioPreview({
  dock,
  draft,
  leading,
  notice,
  onCanvasReady,
  onDismissNotice,
  trailing,
}: Readonly<{
  dock?: ReactNode;
  draft: PackStudioDraft;
  leading?: ReactNode;
  notice: string;
  onCanvasReady: (canvas: Canvas | null) => void;
  onDismissNotice: () => void;
  trailing?: ReactNode;
}>) {
  const [context, setContext] = useState<PreviewContext>('editor');
  const [zoom, setZoom] = useState<(typeof zoomLevels)[number]>(100);
  const zoomIndex = zoomLevels.indexOf(zoom);
  return (
    <main
      className={`studio-stage pack-studio-canvas-region pack-studio-preview--${context}`}
      style={
        {
          '--studio-collection-primary': draft.color,
          '--studio-collection-secondary': draft.accentColor,
        } as CSSProperties
      }
    >
      <div className="studio-stage__toolbar">
        <div className="studio-stage__group">
          {leading}
          <span className="studio-live">
            <i />
            Arte 600 × 800
          </span>
        </div>
        <StudioSegmented
          label="Contexto da prévia"
          onChange={setContext}
          options={contexts}
          value={context}
        />
        <div className="studio-stage__group">
          <fieldset className="studio-zoom" disabled={context !== 'editor'}>
            <legend className="sr-only">Zoom do canvas</legend>
            <button
              aria-label="Diminuir zoom"
              disabled={zoomIndex === 0}
              onClick={() => setZoom(zoomLevels[Math.max(0, zoomIndex - 1)])}
              type="button"
            >
              <StudioIcon name="minus" />
            </button>
            <button
              aria-label="Ajustar zoom"
              className="studio-zoom__value"
              onClick={() => setZoom(100)}
              type="button"
            >
              {context === 'editor' ? zoom : 100}%
            </button>
            <button
              aria-label="Aumentar zoom"
              disabled={zoomIndex === zoomLevels.length - 1}
              onClick={() => setZoom(zoomLevels[Math.min(zoomLevels.length - 1, zoomIndex + 1)])}
              type="button"
            >
              <StudioIcon name="plus" />
            </button>
          </fieldset>
          {trailing}
        </div>
      </div>
      <div className="studio-canvas-shell pack-studio-canvas-shell">
        <div
          className="pack-studio-stage"
          style={{ '--pack-zoom': context === 'editor' ? zoom / 100 : 1 } as CSSProperties}
        >
          <div className="pack-studio-preview-card">
            <div className="pack-studio-preview-art">
              <PackCanvas draft={draft} onCanvasReady={onCanvasReady} />
            </div>
            <div className="pack-studio-preview-details" hidden={context === 'editor'}>
              <p className="studio-eyebrow">
                {context === 'store' ? 'Pack de cartas' : '96 × 128 px'}
              </p>
              <h2>{draft.name || 'Novo pack'}</h2>
              <p>
                {draft.cardsAmount} {draft.cardsAmount === 1 ? 'carta' : 'cartas'}
              </p>
              <strong>{draft.price.toLocaleString('pt-BR')} moedas</strong>
            </div>
          </div>
        </div>
        {notice && (
          <p aria-live="polite" className="studio-toast pack-studio-notice">
            <span>{notice}</span>
            <button aria-label="Dispensar aviso" onClick={onDismissNotice} type="button">
              <StudioIcon name="close" />
            </button>
          </p>
        )}
      </div>
      <footer className="studio-stage__dock">
        <p className="studio-stage__caption">
          {context === 'editor'
            ? 'Fundo transparente na exportação · texto aplicado na face 3D'
            : context === 'store'
              ? 'Simulação de vitrine · sem compra real'
              : 'Simulação em tamanho reduzido · confira contraste e leitura'}
        </p>
        {dock && <div className="studio-stage__group">{dock}</div>}
      </footer>
    </main>
  );
}
