import type { Canvas } from 'fabric';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminIcon } from '../../components/admin-icon';
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
import { PackStudioPresets } from './pack-studio-presets';
import { PackStudioPreview } from './pack-studio-preview';
import { parsePackStudioProjectJson } from './pack-studio-project';
import { StudioCanvas, StudioHeader, StudioSidebar, StudioWorkspace } from './studio-workspace';

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

  return (
    <section aria-labelledby="pack-studio-title" className="pack-studio-page">
      <StudioHeader className="pack-studio-topbar">
        <div className="pack-studio-brand">
          <AdminIcon className="pack-studio-brand__mark" name="pack" />
          <div>
            <p className="eyebrow">Studio de Packs</p>
            <h1 id="pack-studio-title">{draft.name || 'Novo pack'}</h1>
            <output className="pack-studio-save-state">{publicationState}</output>
          </div>
        </div>
        <div className="pack-studio-topbar__actions">
          <button
            className="text-button"
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
            type="file"
          />
          <button
            className="text-button"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
            type="button"
          >
            {importing ? 'Importando...' : 'Importar .futhub'}
          </button>
          <button
            className="ops-button secondary"
            onClick={() => setExperienceOpen(true)}
            type="button"
          >
            Testar abertura
          </button>
          <button
            className="ops-button secondary"
            onClick={() => setExportOpen(true)}
            type="button"
          >
            Exportar
          </button>
          <button
            className="ops-button accent"
            disabled={!canSave}
            onClick={() => void saveArtwork()}
            type="button"
          >
            {saving ? 'Publicando...' : 'Salvar e publicar'}
          </button>
        </div>
      </StudioHeader>

      <StudioWorkspace className="pack-studio-workspace">
        <StudioSidebar aria-label="Biblioteca e camadas do pack" className="pack-studio-layers">
          <div className="pack-studio-panel-heading">
            <div>
              <p className="eyebrow">Ponto de partida</p>
              <h2>Biblioteca</h2>
            </div>
            <button
              className="pack-studio-icon-button"
              disabled={loading || saving}
              onClick={() => choosePack('')}
              type="button"
            >
              <span aria-hidden="true">+</span>
              <span className="sr-only">Criar novo pack</span>
            </button>
          </div>
          <PackStudioPresets
            draft={draft}
            onApplyArt={(art) => {
              setDraft((current) => ({ ...current, ...art }));
              selectLayer('background');
            }}
          />
          <div className="pack-studio-composition-heading">
            <h2>Camadas</h2>
            <span>3 elementos</span>
          </div>
          <div className="pack-studio-layer-list" aria-label="Camadas editáveis">
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
          </div>
          <p className="pack-studio-layers__hint">
            Selecione uma camada e ajuste texto, posição ou acabamento no painel de propriedades.
          </p>
        </StudioSidebar>

        <StudioCanvas className="pack-studio-canvas">
          <PackStudioPreview
            draft={draft}
            onCanvasReady={(canvas) => {
              canvasRef.current = canvas;
              setCanvasReady(canvas !== null);
            }}
          />
        </StudioCanvas>

        <StudioSidebar aria-label="Propriedades do pack" className="pack-studio-inspector">
          <PackStudioInspector
            activeLayer={activeLayer}
            activeTab={activeTab}
            draft={draft}
            loading={loading}
            packs={packs}
            selectedId={selectedId}
            onChoosePack={choosePack}
            onChange={updateDraft}
            onEditFrontImage={() => setFrontImageEditorOpen(true)}
            onSelectLayer={selectLayer}
            onSelectTab={setActiveTab}
          />
          {notice && <output className="pack-studio-notice">{notice}</output>}
        </StudioSidebar>
      </StudioWorkspace>

      {experienceOpen && (
        <PackStudioExperience draft={draft} onClose={() => setExperienceOpen(false)} />
      )}
      {frontImageEditorOpen && (
        <dialog aria-label="Ajustar foto frontal" className="pack-studio-image-dialog" open>
          <div className="pack-studio-image-dialog__surface">
            <button
              aria-label="Fechar ajuste de foto"
              className="pack-studio-image-dialog__close"
              onClick={() => setFrontImageEditorOpen(false)}
              type="button"
            >
              Fechar
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
    </section>
  );
}
