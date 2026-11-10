import type { Canvas } from 'fabric';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { type Pack, createPack, listPacks, updatePack, uploadPackImage } from '../packs/actions';
import { ImageTreatment, type ImageTreatmentTarget } from './image-treatment';
import { packCanvasPng } from './pack-canvas';
import { PackExportDialog } from './pack-export-dialog';
import { PackStudioExperience } from './pack-studio-experience';
import {
  PackStudioInspector,
  type PackStudioLayer,
  type PackStudioTab,
  packStudioLayers,
} from './pack-studio-inspector';
import {
  type PackStudioDraft,
  defaultPackStudioDraft,
  packStudioDraft,
  packStudioInput,
} from './pack-studio-model';
import { PackStudioPreview } from './pack-studio-preview';
import { parsePackStudioProjectJson } from './pack-studio-project';
import { StudioIcon } from './studio-icon';
import {
  StudioBody,
  StudioPanelHeader,
  StudioRail,
  StudioShell,
  StudioTopbar,
  isStudioDrawerViewport,
} from './studio-workspace';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível salvar o pack.';
}

const packFrontImageTarget = {
  description:
    'PNG 1024 × 1536 é padrão da frente do pack. Corte aqui; textura acompanha contorno e dobras do foil.',
  fileName: 'frente-do-pack',
  height: 1536,
  label: 'frente do pack',
  width: 1024,
} satisfies ImageTreatmentTarget;

function blobDataUrl(blob: Blob): Promise<string> {
  const { promise, reject, resolve } = Promise.withResolvers<string>();
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') resolve(reader.result);
    else reject(new Error('Não foi possível preparar a foto frontal.'));
  };
  reader.onerror = () => reject(new Error('Não foi possível ler a foto frontal.'));
  reader.readAsDataURL(blob);
  return promise;
}

export function PackStudio() {
  const location = useLocation();
  const navigate = useNavigate();
  const canvasRef = useRef<Canvas | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const linkedPack = (location.state as { pack?: Pack } | null)?.pack ?? null;
  const initialSelectedId = useRef(linkedPack?.id ?? '');
  const [packs, setPacks] = useState<readonly Pack[]>([]);
  const [selectedId, setSelectedId] = useState(linkedPack?.id ?? '');
  const [draft, setDraft] = useState<PackStudioDraft>(
    linkedPack ? packStudioDraft(linkedPack) : defaultPackStudioDraft,
  );
  const [activeTab, setActiveTab] = useState<PackStudioTab>('design');
  const [activeLayer, setActiveLayer] = useState<PackStudioLayer>('background');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [experienceOpen, setExperienceOpen] = useState(false);
  const [frontImageEditorOpen, setFrontImageEditorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [leftOpen, setLeftOpen] = useState(() => !isStudioDrawerViewport());
  const [rightOpen, setRightOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [publishedDraft, setPublishedDraft] = useState(
    linkedPack ? JSON.stringify(packStudioDraft(linkedPack)) : '',
  );

  useEffect(() => {
    void listPacks()
      .then((items) => {
        setPacks(items);
        const selected =
          items.find((item) => item.id === initialSelectedId.current) ?? items[0] ?? null;
        if (selected) {
          setSelectedId(selected.id);
          setDraft(packStudioDraft(selected));
          setPublishedDraft(JSON.stringify(packStudioDraft(selected)));
        }
      })
      .catch((error: unknown) => setNotice(message(error)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!focusMode) return;
    document.body.classList.add('studio-focus-active');
    function exitFocus(event: KeyboardEvent) {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setFocusMode(false);
    }
    window.addEventListener('keydown', exitFocus);
    return () => {
      document.body.classList.remove('studio-focus-active');
      window.removeEventListener('keydown', exitFocus);
    };
  }, [focusMode]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const pack = useMemo(
    () => packs.find((item) => item.id === selectedId) ?? null,
    [packs, selectedId],
  );
  const canSave = draft.name.trim().length > 0 && !loading && !saving && canvasReady;
  const publicationState = saving
    ? 'Publicando…'
    : loading
      ? 'Carregando packs…'
      : !selectedId
        ? 'Rascunho local · não publicado'
        : JSON.stringify(draft) === publishedDraft
          ? 'Versão publicada'
          : 'Alterações não publicadas';

  function updateDraft<Key extends keyof PackStudioDraft>(key: Key, value: PackStudioDraft[Key]) {
    setDraft((current) => {
      if (
        key === 'cardsAmount' &&
        typeof value === 'number' &&
        current.headline === `${current.cardsAmount} CARTAS`
      ) {
        return { ...current, cardsAmount: value, headline: `${value} CARTAS` };
      }
      return { ...current, [key]: value };
    });
  }

  function selectLayer(layer: PackStudioLayer) {
    setActiveLayer(layer);
    setActiveTab('design');
    setRightOpen(true);
  }

  async function applyFrontImage(image: Blob) {
    try {
      const frontImage = await blobDataUrl(image);
      setDraft((current) => ({ ...current, frontImage }));
      setFrontImageEditorOpen(false);
      setNotice('Foto frontal aplicada no foil em 1024 × 1536.');
    } catch (error) {
      setNotice(message(error));
    }
  }

  function choosePack(id: string) {
    const selected = packs.find((item) => item.id === id) ?? null;
    setSelectedId(id);
    setDraft(selected ? packStudioDraft(selected) : defaultPackStudioDraft());
    setPublishedDraft(selected ? JSON.stringify(packStudioDraft(selected)) : '');
    setNotice('');
    if (isStudioDrawerViewport()) setLeftOpen(false);
  }

  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.item(0);
    event.currentTarget.value = '';
    if (!file) return;

    setImporting(true);
    const result = parsePackStudioProjectJson(await file.text());
    setImporting(false);
    if (result.kind === 'invalid') {
      setNotice(result.message);
      return;
    }
    setDraft(result.draft);
    setSelectedId('');
    setActiveTab('design');
    setActiveLayer('background');
    setNotice(`Projeto ${file.name} importado. Salve para publicar como novo pack.`);
  }

  async function saveArtwork() {
    if (!canvasRef.current || !canSave) return;
    setSaving(true);
    try {
      const artwork = await packCanvasPng(canvasRef.current);
      const saved = pack
        ? await updatePack(pack.id, packStudioInput(draft, pack))
        : await createPack(packStudioInput(draft));
      const form = new FormData();
      form.set(
        'image',
        new File(
          [artwork],
          `${saved.name.toLowerCase().replaceAll(/[^a-z0-9]+/gi, '-')}-pack.png`,
          { type: 'image/png' },
        ),
      );
      const updated = await uploadPackImage(saved.id, form);
      setPacks((current) => [...current.filter((item) => item.id !== updated.id), updated]);
      setSelectedId(updated.id);
      setPublishedDraft(JSON.stringify(draft));
      setNotice(pack ? 'Pack atualizado e arte publicada.' : 'Pack criado e arte publicada.');
    } catch (error) {
      if (error instanceof Error) setNotice(error.message);
      else setNotice('Não foi possível salvar o pack.');
    } finally {
      setSaving(false);
    }
  }

  const sortedPacks = [...packs].sort((first, second) => first.name.localeCompare(second.name));

  return (
    <StudioShell focus={focusMode} kind="packs" labelledBy="pack-studio-title">
      <StudioTopbar
        actions={
          <>
            <button
              className="studio-btn studio-btn--ghost"
              onClick={() => navigate('/app/gerenciar/packs')}
              type="button"
            >
              Gestão avançada
            </button>
            <input
              accept=".futhub,application/json"
              className="sr-only"
              onChange={(event) => void importProject(event)}
              ref={importInputRef}
              tabIndex={-1}
              type="file"
            />
            <button
              className="studio-btn studio-btn--ghost"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
              type="button"
            >
              <StudioIcon name="upload" />
              {importing ? 'Importando…' : 'Importar .futhub'}
            </button>
            <button
              className="studio-btn studio-btn--secondary"
              onClick={() => setExperienceOpen(true)}
              type="button"
            >
              <StudioIcon name="sparkle" />
              Testar abertura
            </button>
            <button
              className="studio-btn studio-btn--secondary"
              onClick={() => setExportOpen(true)}
              type="button"
            >
              <StudioIcon name="download" />
              Exportar
            </button>
            <button
              className="studio-btn studio-btn--primary"
              disabled={!canSave}
              onClick={() => void saveArtwork()}
              type="button"
            >
              {saving ? 'Publicando…' : 'Salvar e publicar'}
            </button>
          </>
        }
        icon="pack"
        status={
          <>
            <span
              className="studio-status-dot"
              data-state={
                saving || loading
                  ? 'saving'
                  : publicationState === 'Versão publicada'
                    ? 'saved'
                    : 'pending'
              }
            />
            <span>{draft.name || 'Novo pack'}</span>
            <span aria-hidden="true">·</span>
            <span className="pack-studio-save-state">{publicationState}</span>
          </>
        }
        title="Studio de packs"
        titleId="pack-studio-title"
      />

      <StudioBody left={leftOpen} right={rightOpen}>
        {leftOpen && (
          <StudioRail
            aria-label="Biblioteca e camadas do pack"
            className="studio-library pack-studio-layers"
            side="left"
          >
            <StudioPanelHeader
              actions={
                <>
                  <button
                    aria-label="Criar novo pack"
                    className="studio-icon-button"
                    disabled={loading || saving}
                    onClick={() => choosePack('')}
                    title="Novo pack"
                    type="button"
                  >
                    <StudioIcon name="plus" />
                  </button>
                  <button
                    aria-label="Recolher biblioteca"
                    className="studio-icon-button"
                    onClick={() => setLeftOpen(false)}
                    type="button"
                  >
                    <StudioIcon name="panel-left" />
                  </button>
                </>
              }
              eyebrow="Ponto de partida"
              title="Biblioteca"
            />
            <div aria-busy={loading} className="studio-library__list pack-studio-pack-list">
              {!selectedId && !loading && (
                <div className="studio-library-row" data-selected="true">
                  <div className="studio-library-row__main">
                    <span className="studio-library-row__thumb pack-studio-pack-swatch">
                      <i style={{ background: draft.color }} />
                    </span>
                    <span className="studio-library-row__copy">
                      <strong>{draft.name || 'Novo pack'}</strong>
                      <small>Rascunho local · não publicado</small>
                    </span>
                  </div>
                </div>
              )}
              {loading ? (
                <p className="studio-empty">Carregando packs…</p>
              ) : sortedPacks.length ? (
                sortedPacks.map((item) => (
                  <div
                    className="studio-library-row"
                    data-selected={selectedId === item.id}
                    key={item.id}
                  >
                    <button
                      aria-pressed={selectedId === item.id}
                      className="studio-library-row__main"
                      disabled={saving}
                      onClick={() => choosePack(item.id)}
                      type="button"
                    >
                      <span className="studio-library-row__thumb pack-studio-pack-swatch">
                        {item.imageUrl ? (
                          <img alt="" src={item.imageUrl} />
                        ) : (
                          <i style={{ background: item.color }} />
                        )}
                      </span>
                      <span className="studio-library-row__copy">
                        <strong>{item.name}</strong>
                        <small>
                          {item.cardsAmount} {item.cardsAmount === 1 ? 'carta' : 'cartas'} ·{' '}
                          {item.price.toLocaleString('pt-BR')} moedas
                        </small>
                      </span>
                    </button>
                  </div>
                ))
              ) : (
                <p className="studio-empty">Nenhum pack publicado ainda.</p>
              )}
            </div>
            <div className="studio-rail__section">
              <div className="studio-section__heading">
                <h3 className="studio-section__title">Camadas</h3>
                <small>{packStudioLayers.length} elementos</small>
              </div>
              <fieldset className="pack-studio-layer-list">
                <legend className="sr-only">Camadas editáveis</legend>
                {packStudioLayers.map((layer) => (
                  <button
                    aria-pressed={activeLayer === layer.id}
                    className="pack-studio-layer"
                    key={layer.id}
                    onClick={() => selectLayer(layer.id)}
                    type="button"
                  >
                    <span aria-hidden="true" className="pack-studio-layer__glyph">
                      {layer.glyph}
                    </span>
                    <span>
                      <strong>{layer.label}</strong>
                      <small>
                        {layer.id === 'headline'
                          ? draft.headline
                          : layer.id === 'kicker'
                            ? draft.kicker || 'Opcional'
                            : layer.detail}
                      </small>
                    </span>
                  </button>
                ))}
              </fieldset>
            </div>
          </StudioRail>
        )}

        <PackStudioPreview
          dock={
            <button
              aria-label={focusMode ? 'Sair do modo criação' : 'Modo criação'}
              aria-pressed={focusMode}
              className="studio-tool studio-tool--icon"
              onClick={() => setFocusMode((current) => !current)}
              title={focusMode ? 'Sair do modo criação · Esc' : 'Modo criação'}
              type="button"
            >
              <StudioIcon name={focusMode ? 'shrink' : 'expand'} />
            </button>
          }
          draft={draft}
          leading={
            !leftOpen && (
              <button
                aria-label="Mostrar biblioteca"
                className="studio-tool studio-tool--icon"
                onClick={() => setLeftOpen(true)}
                type="button"
              >
                <StudioIcon name="panel-left" />
              </button>
            )
          }
          notice={notice}
          onCanvasReady={(canvas) => {
            canvasRef.current = canvas;
            setCanvasReady(canvas !== null);
          }}
          onDismissNotice={() => setNotice('')}
          trailing={
            !rightOpen && (
              <button
                aria-label="Mostrar propriedades"
                className="studio-tool studio-tool--icon"
                onClick={() => setRightOpen(true)}
                type="button"
              >
                <StudioIcon name="panel-right" />
              </button>
            )
          }
        />

        {rightOpen && (
          <StudioRail
            aria-label="Propriedades do pack"
            className="studio-inspector pack-studio-inspector"
            side="right"
          >
            <PackStudioInspector
              activeLayer={activeLayer}
              activeTab={activeTab}
              draft={draft}
              loading={loading}
              packs={packs}
              selectedId={selectedId}
              onApplyArt={(art) => {
                setDraft((current) => ({ ...current, ...art }));
                setActiveLayer('background');
              }}
              onChoosePack={choosePack}
              onChange={updateDraft}
              onCollapse={() => setRightOpen(false)}
              onEditFrontImage={() => setFrontImageEditorOpen(true)}
              onSelectLayer={selectLayer}
              onSelectTab={setActiveTab}
            />
          </StudioRail>
        )}
      </StudioBody>

      {experienceOpen && (
        <PackStudioExperience draft={draft} onClose={() => setExperienceOpen(false)} />
      )}
      {frontImageEditorOpen && (
        <dialog aria-label="Ajustar foto frontal" className="pack-studio-image-dialog" open>
          <div className="pack-studio-image-dialog__surface">
            <button
              aria-label="Fechar ajuste de foto"
              className="studio-icon-button pack-studio-image-dialog__close"
              onClick={() => setFrontImageEditorOpen(false)}
              type="button"
            >
              <StudioIcon name="close" />
            </button>
            <ImageTreatment
              onApply={(_imageUrl, image) => void applyFrontImage(image)}
              source={
                draft.frontImage
                  ? { fileName: 'frente-do-pack.png', url: draft.frontImage }
                  : undefined
              }
              target={packFrontImageTarget}
            />
          </div>
        </dialog>
      )}
      {exportOpen && (
        <PackExportDialog
          canvas={canvasRef.current}
          draft={draft}
          onClose={() => setExportOpen(false)}
          onExported={setNotice}
        />
      )}
    </StudioShell>
  );
}
