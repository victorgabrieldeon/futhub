import type { Canvas } from 'fabric';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { packCanvasBlob } from './pack-canvas';
import type { PackStudioDraft } from './pack-studio-model';
import { packStudioProjectFileName, packStudioProjectJson } from './pack-studio-project';

type PackExportDialogProps = Readonly<{
  canvas: Canvas | null;
  draft: PackStudioDraft;
  onClose: () => void;
  onExported: (message: string) => void;
}>;

type ExportFormat = 'png' | 'webp';
type ExportScale = 1 | 2 | 3;
type ExportType = 'image' | 'project';

function fileSlug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'pack'
  );
}

export function PackExportDialog({ canvas, draft, onClose, onExported }: PackExportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [type, setType] = useState<ExportType>('image');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState<ExportScale>(2);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    closeButtonRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  function closeDialog() {
    dialogRef.current?.close();
    onClose();
  }

  async function exportPack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExporting(true);
    try {
      if (type === 'project') {
        const output = new Blob([packStudioProjectJson(draft)], {
          type: 'application/vnd.futhub.pack+json',
        });
        const outputUrl = URL.createObjectURL(output);
        const link = document.createElement('a');
        link.href = outputUrl;
        link.download = packStudioProjectFileName(draft);
        link.click();
        URL.revokeObjectURL(outputUrl);
        onExported('Projeto .futhub exportado.');
        closeDialog();
        return;
      }
      if (!canvas) return;
      const output = await packCanvasBlob(canvas, format, scale);
      const outputUrl = URL.createObjectURL(output);
      const link = document.createElement('a');
      link.href = outputUrl;
      link.download = `${fileSlug(draft.name)}-${600 * scale}x${800 * scale}.${format}`;
      link.click();
      URL.revokeObjectURL(outputUrl);
      onExported(`Pack exportado em ${format.toUpperCase()} ${600 * scale} × ${800 * scale}.`);
      closeDialog();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="studio-dialog-backdrop" role="presentation">
      <dialog
        aria-labelledby="pack-export-title"
        className="pack-export-dialog"
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        ref={dialogRef}
      >
        <header>
          <div>
            <p className="eyebrow">Arquivo final</p>
            <h2 id="pack-export-title">Exportar pack</h2>
          </div>
          <button
            aria-label="Fechar exportação"
            onClick={closeDialog}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </header>
        <form onSubmit={(event) => void exportPack(event)}>
          <fieldset className="pack-export-options">
            <legend>Arquivo</legend>
            <label>
              <input
                checked={type === 'image'}
                name="pack-export-type"
                onChange={() => setType('image')}
                type="radio"
              />
              <span>
                <strong>Arte</strong>
                <small>Imagem pronta para catálogo</small>
              </span>
            </label>
            <label>
              <input
                checked={type === 'project'}
                name="pack-export-type"
                onChange={() => setType('project')}
                type="radio"
              />
              <span>
                <strong>Projeto .futhub</strong>
                <small>Reabra composição no Studio</small>
              </span>
            </label>
          </fieldset>
          {type === 'image' && (
            <>
              <fieldset className="pack-export-options">
                <legend>Formato</legend>
                {(['png', 'webp'] as const).map((value) => (
                  <label key={value}>
                    <input
                      checked={format === value}
                      name="pack-format"
                      onChange={() => setFormat(value)}
                      type="radio"
                    />
                    <span>
                      <strong>{value.toUpperCase()}</strong>
                      <small>{value === 'png' ? 'Máxima fidelidade' : 'Arquivo mais leve'}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="pack-export-options">
                <legend>Resolução</legend>
                {([1, 2, 3] as const).map((value) => (
                  <label key={value}>
                    <input
                      checked={scale === value}
                      name="pack-scale"
                      onChange={() => setScale(value)}
                      type="radio"
                    />
                    <span>
                      <strong>{value}×</strong>
                      <small>
                        {600 * value} × {800 * value}px
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
          <div className="pack-export-summary">
            <span>Prévia</span>
            <strong>{draft.name || 'Novo pack'}</strong>
            <small>
              {type === 'project'
                ? 'Schema v1 · configuração editável'
                : `${format.toUpperCase()} · ${600 * scale} × ${800 * scale}px`}
            </small>
          </div>
          <footer>
            <button onClick={closeDialog} type="button">
              Cancelar
            </button>
            <button
              className="ops-button accent"
              disabled={exporting || (type === 'image' && !canvas)}
              type="submit"
            >
              {exporting ? 'Gerando…' : 'Baixar arquivo'}
            </button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
