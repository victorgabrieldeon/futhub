import {
  type PlayerPhotoSuggestion,
  getV1AdminCardsPlayerPhotoSuggestions,
} from '@futhub/api-client';
import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { adminApiOptions } from '../../api/admin-client';
import { AdminIcon } from '../../components/admin-icon';
import {
  type Card,
  type Collection,
  type Page,
  listCards,
  listCollections,
  uploadCardImage,
} from '../cards/actions';
import { cardFramePaths } from './card-design';
import { CardDesignFields } from './card-design-fields';
import { CardEdition, CardNameplate, CardTexture } from './card-details';
import { cardModelImage } from './card-model';
import { ImageTreatment } from './image-treatment';
import {
  type CardFinish,
  type CardRarity,
  type InspectorPanel,
  type LayerKey,
  type PreviewMode,
  type StatKey,
  type StudioAssetKind,
  type StudioDraft,
  assetExtension,
  defaultLayerOrder,
  emptyDraft,
  inspectDraft,
  layerDefinitions,
  moveLayer,
  parseStoredDraft,
  positions,
  statFields,
  statsForPosition,
  studioAssetDefinitions,
  studioAssetSize,
  stylePresets,
} from './studio-model';
import { StudioCanvas, StudioHeader, StudioSidebar, StudioWorkspace } from './studio-workspace';

const studioSessionKey = 'futhub.admin.studio.session.v3';
const movableLayers = ['photo', 'rating', 'identity', 'stats'] as const;
const finishOptions: readonly Readonly<{ id: CardFinish; label: string }>[] = [
  { id: 'matte', label: 'Matte' },
  { id: 'foil', label: 'Foil' },
  { id: 'holo', label: 'Holographic' },
  { id: 'chrome', label: 'Chrome' },
  { id: 'energy', label: 'Energy' },
  { id: 'retro', label: 'Retro' },
];
const rarityOptions: readonly Readonly<{ id: CardRarity; label: string }>[] = [
  { id: 'common', label: 'Common' },
  { id: 'rare', label: 'Rare' },
  { id: 'epic', label: 'Epic' },
  { id: 'legendary', label: 'Legendary' },
  { id: 'icon', label: 'Icon' },
];
const previewModes: readonly Readonly<{ id: PreviewMode; label: string }>[] = [
  { id: 'isolated', label: 'Card' },
  { id: 'discord', label: 'Discord' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'artwork', label: 'Arte' },
];
const inspectorTabs: readonly Readonly<{ id: InspectorPanel; label: string }>[] = [
  { id: 'data', label: 'Conteúdo' },
  { id: 'photo', label: 'Foto' },
  { id: 'visual', label: 'Visual' },
  { id: 'layers', label: 'Ajuste' },
];

const layerGroups: readonly Readonly<{ label: string; layers: readonly LayerKey[] }>[] = [
  { label: 'Arte', layers: ['photo', 'effects', 'background'] },
  { label: 'Informações', layers: ['stats', 'identity', 'badges', 'rating'] },
];

type BrowserFilter = 'all' | 'recent' | 'favorites';
type MovableLayer = (typeof movableLayers)[number];
type AutosaveState = 'saving' | 'saved' | 'error';
type ExportFormat = 'png' | 'webp';
type StudioMode = 'cards' | 'image';

type Snapshot = Readonly<{
  id: string;
  name: string;
  createdAt: number;
  draft: StudioDraft;
}>;

type StoredSession = Readonly<{
  draft: StudioDraft | null;
  selectedCardId: string;
  snapshots: readonly Snapshot[];
  favoriteIds: readonly string[];
  recentIds: readonly string[];
}>;

type ExportOptions = Readonly<{
  assetKind: StudioAssetKind;
  format: ExportFormat;
  width: number;
  transparentBackground: boolean;
  highQuality: boolean;
  includeShadow: boolean;
  optimizeDiscord: boolean;
}>;

type DragState = {
  layer: MovableLayer;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  cardWidth: number;
  baseDraft: StudioDraft;
};

export function Studio() {
  const location = useLocation();
  const navigate = useNavigate();
  const linkedCard = (location.state as { card?: Card } | null)?.card ?? null;
  const linkedCardId = useRef('');
  const restoredSession = useRef(readStoredSession());
  const [draft, setDraft] = useState<StudioDraft>(restoredSession.current.draft ?? emptyDraft);
  const [workspace, setWorkspace] = useState<StudioMode>('cards');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [players, setPlayers] = useState<Page<Card> | null>(null);
  const [selectedCardId, setSelectedCardId] = useState(restoredSession.current.selectedCardId);
  const [playerQuery, setPlayerQuery] = useState('');
  const [playersLoading, setPlayersLoading] = useState(true);
  const [browserFilter, setBrowserFilter] = useState<BrowserFilter>('all');
  const [favoriteIds, setFavoriteIds] = useState<readonly string[]>(
    restoredSession.current.favoriteIds,
  );
  const [recentIds, setRecentIds] = useState<readonly string[]>(restoredSession.current.recentIds);
  const [panel, setPanel] = useState<InspectorPanel>('data');
  const [activeLayer, setActiveLayer] = useState<LayerKey | null>(null);
  const [photoQuery, setPhotoQuery] = useState('');
  const [photoSuggestions, setPhotoSuggestions] = useState<PlayerPhotoSuggestion[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [savingCardImage, setSavingCardImage] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [notice, setNotice] = useState('');
  const [smartFillCount, setSmartFillCount] = useState(0);
  const [playground, setPlayground] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [focusReveal, setFocusReveal] = useState<'right' | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [draggedLayer, setDraggedLayer] = useState<LayerKey | null>(null);
  const [zoom, setZoom] = useState(100);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('isolated');
  const [historyPast, setHistoryPast] = useState<readonly StudioDraft[]>([]);
  const [historyFuture, setHistoryFuture] = useState<readonly StudioDraft[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<readonly Snapshot[]>(
    restoredSession.current.snapshots,
  );
  const [snapshotName, setSnapshotName] = useState('');
  const [compareDraft, setCompareDraft] = useState<StudioDraft | null>(null);
  const [compareLabel, setCompareLabel] = useState('');
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('saved');
  const [dataReady, setDataReady] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    assetKind: 'ea-fc-item',
    format: 'png',
    width: 600,
    transparentBackground: true,
    highQuality: true,
    includeShadow: false,
    optimizeDiscord: false,
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const localPhotoUrl = useRef('');
  const playerSearchSequence = useRef(0);
  const originalDraft = useRef<StudioDraft>(restoredSession.current.draft ?? emptyDraft);
  const playgroundBase = useRef<StudioDraft | null>(null);
  const dragState = useRef<DragState | null>(null);
  const lastHistoryEdit = useRef<{ key: keyof StudioDraft; at: number } | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const overallInputRef = useRef<HTMLInputElement>(null);
  const firstStatInputRef = useRef<HTMLInputElement>(null);
  const photoSearchRef = useRef<HTMLInputElement>(null);
  const playerBrowserSearchRef = useRef<HTMLInputElement>(null);
  const commandSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([listCards(1, 12, { sort: 'recent' }), listCollections(1, 100)])
      .then(([cardPage, collectionPage]) => {
        if (!active) return;
        setPlayers(cardPage);
        setCollections(collectionPage.items);
        const stored = restoredSession.current;
        if (stored.draft) {
          const sourceCard = cardPage.items.find((card) => card.id === stored.selectedCardId);
          if (sourceCard) originalDraft.current = draftFromCard(sourceCard, collectionPage.items);
          setPhotoQuery(stored.draft.name === emptyDraft.name ? '' : stored.draft.name);
        }
      })
      .catch((error: unknown) => {
        if (active) setNotice(message(error));
      })
      .finally(() => {
        if (active) {
          setPlayersLoading(false);
          setDataReady(true);
        }
      });
    return () => {
      active = false;
      if (localPhotoUrl.current) URL.revokeObjectURL(localPhotoUrl.current);
    };
  }, []);

  useEffect(() => {
    if (!linkedCard || !collections.length || linkedCardId.current === linkedCard.id) return;
    applyCard(linkedCard, collections);
    linkedCardId.current = linkedCard.id;
  }, [collections, linkedCard]);

  useEffect(() => {
    const sequence = ++playerSearchSequence.current;
    const timer = window.setTimeout(() => {
      setPlayersLoading(true);
      void listCards(1, 12, { query: playerQuery.trim() || undefined, sort: 'name' })
        .then((page) => {
          if (sequence === playerSearchSequence.current) setPlayers(page);
        })
        .catch((error: unknown) => {
          if (sequence === playerSearchSequence.current) setNotice(message(error));
        })
        .finally(() => {
          if (sequence === playerSearchSequence.current) setPlayersLoading(false);
        });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [playerQuery]);

  useEffect(() => {
    const query = photoQuery.trim();
    if (query.length < 2) {
      setPhotoSuggestions([]);
      setPhotosLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPhotosLoading(true);
      void getV1AdminCardsPlayerPhotoSuggestions(
        { q: query },
        { ...adminApiOptions(), signal: controller.signal },
      )
        .then((suggestions) => {
          if (!controller.signal.aborted) setPhotoSuggestions(suggestions);
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setNotice(message(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setPhotosLoading(false);
        });
    }, 260);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [photoQuery]);

  useEffect(() => {
    if (!dataReady) return;
    setAutosaveState('saving');
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          studioSessionKey,
          JSON.stringify({ draft, selectedCardId, snapshots, favoriteIds, recentIds }),
        );
        setAutosaveState('saved');
      } catch {
        setAutosaveState('error');
      }
    }, 420);
    return () => window.clearTimeout(timer);
  }, [dataReady, draft, favoriteIds, recentIds, selectedCardId, snapshots]);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveLayer(null);
        setExportOpen(false);
        setHistoryOpen(false);
        setCompareDraft(null);
        setCommandPaletteOpen(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openCommandPalette();
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
        return;
      if (event.shiftKey && event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        toggleFocusMode();
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      lastHistoryEdit.current = null;
      if (event.shiftKey) {
        const next = historyFuture[0];
        if (!next) return;
        setHistoryFuture((current) => current.slice(1));
        setHistoryPast((current) => [...current, draft].slice(-50));
        setDraft(next);
        setNotice('Alteração refeita.');
        return;
      }
      const previous = historyPast.at(-1);
      if (!previous) return;
      setHistoryPast((current) => current.slice(0, -1));
      setHistoryFuture((current) => [draft, ...current].slice(0, 50));
      setDraft(previous);
      setNotice('Alteração desfeita.');
    }
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [draft, historyFuture, historyPast]);
  useEffect(() => {
    document.body.classList.toggle('studio-focus-active', focusMode);
    return () => document.body.classList.remove('studio-focus-active');
  }, [focusMode]);

  useEffect(() => {
    const definition = layerDefinitions.find((entry) => entry.id === activeLayer);
    if (!activeLayer || !rightOpen || definition?.panel !== panel) return;
    const timer = window.setTimeout(() => {
      if (activeLayer === 'photo') photoSearchRef.current?.focus();
      if (activeLayer === 'rating') overallInputRef.current?.focus();
      if (activeLayer === 'identity') nameInputRef.current?.focus();
      if (activeLayer === 'stats') firstStatInputRef.current?.focus();
    });
    return () => window.clearTimeout(timer);
  }, [activeLayer, panel, rightOpen]);

  const selectedCollection = collections.find(
    (collection) => collection.name === draft.collectionName,
  );
  const healthChecks = useMemo(() => inspectDraft(draft), [draft]);
  const teamLogoReady = assetExtension(draft.teamLogoUrl) === 'svg';
  const playerPhotoSelected = draft.photoFormat !== 'missing' && Boolean(draft.playerImageUrl);
  const playerPhotoReady = playerPhotoSelected && draft.photoIsStandard;
  const selectedAsset =
    studioAssetDefinitions.find((asset) => asset.id === exportOptions.assetKind) ??
    studioAssetDefinitions[0];
  const qualityReady = playerPhotoReady && (selectedAsset.id === 'player-image' || teamLogoReady);
  const exportSize = studioAssetSize(exportOptions.assetKind, exportOptions.width);
  const visiblePlayers = useMemo(() => {
    const items = players?.items ?? [];
    if (browserFilter === 'favorites') return items.filter((card) => favoriteIds.includes(card.id));
    if (browserFilter === 'recent') {
      return [...items].sort((first, second) => {
        const firstIndex = recentIds.indexOf(first.id);
        const secondIndex = recentIds.indexOf(second.id);
        return (firstIndex < 0 ? 99 : firstIndex) - (secondIndex < 0 ? 99 : secondIndex);
      });
    }
    return items;
  }, [browserFilter, favoriteIds, players, recentIds]);

  function applyCard(card: Card, availableCollections = collections) {
    if (localPhotoUrl.current) {
      URL.revokeObjectURL(localPhotoUrl.current);
      localPhotoUrl.current = '';
    }
    const next = draftFromCard(card, availableCollections);
    lastHistoryEdit.current = null;
    setSelectedCardId(card.id);
    setPhotoQuery(card.name);
    setDraft(next);
    originalDraft.current = next;
    setHistoryPast([]);
    setHistoryFuture([]);
    setCompareDraft(null);
    setRecentIds((current) => [card.id, ...current.filter((id) => id !== card.id)].slice(0, 6));
    setSmartFillCount(14);
    setNotice('Smart Fill concluído: 14 campos encontrados. Revise antes de exportar.');
  }

  function commitDraft(next: StudioDraft, nextNotice?: string) {
    lastHistoryEdit.current = null;
    if (next === draft) return;
    setHistoryPast((current) => [...current, draft].slice(-50));
    setHistoryFuture([]);
    setDraft(next);
    if (nextNotice) setNotice(nextNotice);
  }

  function updateDraft<Key extends keyof StudioDraft>(key: Key, value: StudioDraft[Key]) {
    if (draft[key] === value) return;
    const now = performance.now();
    const lastEdit = lastHistoryEdit.current;
    if (lastEdit?.key === key && now - lastEdit.at < 600) {
      setHistoryFuture([]);
      setDraft({ ...draft, [key]: value });
    } else {
      commitDraft({ ...draft, [key]: value });
    }
    lastHistoryEdit.current = { key, at: now };
  }

  function undoDraft() {
    lastHistoryEdit.current = null;
    const previous = historyPast.at(-1);
    if (!previous) return;
    setHistoryPast((current) => current.slice(0, -1));
    setHistoryFuture((current) => [draft, ...current].slice(0, 50));
    setDraft(previous);
    setNotice('Alteração desfeita.');
  }

  function redoDraft() {
    lastHistoryEdit.current = null;
    const next = historyFuture[0];
    if (!next) return;
    setHistoryFuture((current) => current.slice(1));
    setHistoryPast((current) => [...current, draft].slice(-50));
    setDraft(next);
    setNotice('Alteração refeita.');
  }

  function choosePhoto(suggestion: PlayerPhotoSuggestion) {
    if (localPhotoUrl.current) {
      URL.revokeObjectURL(localPhotoUrl.current);
      localPhotoUrl.current = '';
    }
    commitDraft(
      {
        ...draft,
        playerImageUrl: suggestion.imageUrl,
        photoFormat: assetExtension(suggestion.imageUrl) === 'png' ? 'png' : 'other',
        photoIsStandard: false,
      },
      `Foto de ${suggestion.name} selecionada. Padronize o recorte antes de salvar ou exportar.`,
    );
  }
  async function saveCardImage() {
    if (!selectedCardId || !qualityReady || !svgRef.current) return;
    setSavingCardImage(true);
    try {
      const cardImage = await loadStudioCard(svgRef.current, 'ea-fc-item', draft);
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 800;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível preparar a imagem do card.');
      context.drawImage(cardImage, 0, 0, canvas.width, canvas.height);
      const image = await canvasBlob(canvas, 'image/png', 1);
      const form = new FormData();
      form.set(
        'image',
        new File([image], `${fileSlug(draft.name)}-card.png`, { type: 'image/png' }),
      );
      const card = await uploadCardImage(selectedCardId, form);
      setPlayers((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) => (item.id === card.id ? card : item)),
            }
          : current,
      );
      setNotice('Imagem do card salva no jogador.');
    } catch (error) {
      setNotice(`Falha ao salvar imagem: ${message(error)}`);
    } finally {
      setSavingCardImage(false);
    }
  }

  function clearLayerSelection() {
    setActiveLayer(null);
  }

  function selectLayer(layer: LayerKey) {
    if (activeLayer === layer) {
      clearLayerSelection();
      return;
    }
    const definition = layerDefinitions.find((entry) => entry.id === layer);
    setActiveLayer(layer);
    setPanel(definition?.panel ?? 'layers');
    setRightOpen(true);
    setFocusMode(false);
  }

  function openProofCheck(nextPanel: InspectorPanel) {
    setActiveLayer(null);
    setPanel(nextPanel);
    setRightOpen(true);
    setFocusMode(false);
    window.setTimeout(() => {
      const inspector = document.querySelector('.card-studio-page .studio-inspector');
      if (window.matchMedia('(max-width: 980px)').matches) {
        inspector?.scrollIntoView({ block: 'start' });
      }
      inspector
        ?.querySelector<HTMLButtonElement>('.studio-inspector-tabs [aria-selected="true"]')
        ?.focus({ preventScroll: true });
    });
  }

  function togglePlayground() {
    if (!playground) {
      playgroundBase.current = draft;
      setPlayground(true);
      setNotice('Playground ativo. Arraste camadas desbloqueadas direto no card.');
      return;
    }
    setPlayground(false);
    setNotice('Playground encerrado. A composição foi mantida.');
  }

  function restorePlaygroundBase() {
    if (!playgroundBase.current) return;
    commitDraft(playgroundBase.current, 'Composição restaurada ao estado anterior ao Playground.');
  }

  function restoreCollectionDefaults() {
    const collection = selectedCollection;
    commitDraft(
      {
        ...draft,
        primaryColor: collection?.primaryColor ?? emptyDraft.primaryColor,
        design: emptyDraft.design,
        secondaryColor: collection?.secondaryColor ?? emptyDraft.secondaryColor,
        style: 'signature',
        finish: 'foil',
        rarity: 'rare',
        photoScale: 100,
        photoX: 0,
        photoY: 0,
        ratingX: 0,
        ratingY: 0,
        identityX: 0,
        identityY: 0,
        statsX: 0,
        statsY: 0,
        layerVisibility: emptyDraft.layerVisibility,
        layerLocks: emptyDraft.layerLocks,
        layerOrder: defaultLayerOrder,
      },
      'Padrão visual da coleção restaurado.',
    );
  }

  function createSnapshot(name = snapshotName.trim()) {
    const nextName = name || `Versão ${snapshots.length + 1}`;
    const snapshot: Snapshot = {
      id: crypto.randomUUID(),
      name: nextName,
      createdAt: Date.now(),
      draft,
    };
    setSnapshots((current) => [snapshot, ...current].slice(0, 8));
    setSnapshotName('');
    setNotice(`Snapshot “${nextName}” criado.`);
  }

  function applyPreset(preset: (typeof stylePresets)[number]) {
    commitDraft(
      {
        ...draft,
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        style: preset.style,
        finish: preset.finish,
        rarity: preset.rarity,
      },
      `Preset ${preset.label} aplicado.`,
    );
  }

  function randomizeVisual() {
    const candidates = stylePresets.filter(
      (preset) =>
        preset.primaryColor !== draft.primaryColor ||
        preset.secondaryColor !== draft.secondaryColor,
    );
    const preset = candidates[Math.floor(Math.random() * candidates.length)] ?? stylePresets[0];
    applyPreset(preset);
  }

  function applySuggestedStats() {
    commitDraft(
      { ...draft, ...statsForPosition(draft.position, draft.overall) },
      `Stats equilibrados para ${draft.position} e overall ${draft.overall}.`,
    );
  }

  function randomCard() {
    const candidates = players?.items.filter((card) => card.id !== selectedCardId) ?? [];
    const card = candidates[Math.floor(Math.random() * candidates.length)] ?? players?.items[0];
    if (card) applyCard(card);
  }

  function toggleFavorite(cardId: string) {
    setFavoriteIds((current) =>
      current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId],
    );
  }

  function toggleLayerVisibility(layer: LayerKey) {
    commitDraft({
      ...draft,
      layerVisibility: {
        ...draft.layerVisibility,
        [layer]: !draft.layerVisibility[layer],
      },
    });
  }

  function toggleLayerLock(layer: LayerKey) {
    commitDraft({
      ...draft,
      layerLocks: {
        ...draft.layerLocks,
        [layer]: !draft.layerLocks[layer],
      },
    });
  }

  function reorderLayer(layer: LayerKey, direction: -1 | 1) {
    const nextOrder = moveLayer(draft.layerOrder, layer, direction);
    if (nextOrder === draft.layerOrder) return;
    commitDraft({ ...draft, layerOrder: nextOrder });
  }

  function reorderLayerTo(layer: LayerKey, target: LayerKey) {
    if (layer === target) return;
    const nextOrder = draft.layerOrder.filter((entry) => entry !== layer);
    const targetIndex = nextOrder.indexOf(target);
    if (targetIndex < 0) return;
    nextOrder.splice(targetIndex + 1, 0, layer);
    commitDraft({ ...draft, layerOrder: nextOrder });
  }

  function startLayerReorder(event: ReactDragEvent<HTMLDivElement>, layer: LayerKey) {
    event.dataTransfer.effectAllowed = 'move';
    setDraggedLayer(layer);
  }

  function completeLayerReorder(event: ReactDragEvent<HTMLDivElement>, target: LayerKey) {
    event.preventDefault();
    if (draggedLayer) reorderLayerTo(draggedLayer, target);
    setDraggedLayer(null);
  }

  function beginLayerDrag(layer: MovableLayer, event: ReactPointerEvent<HTMLButtonElement>) {
    if (!playground || draft.layerLocks[layer]) return;
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds?.width) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    let startX = 0;
    let startY = 0;
    if (layer === 'photo') {
      startX = draft.photoX;
      startY = draft.photoY;
    } else if (layer === 'rating') {
      startX = draft.ratingX;
      startY = draft.ratingY;
    } else if (layer === 'identity') {
      startX = draft.identityX;
      startY = draft.identityY;
    } else {
      startX = draft.statsX;
      startY = draft.statsY;
    }
    dragState.current = {
      layer,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX,
      startY,
      cardWidth: bounds.width,
      baseDraft: draft,
    };
  }

  function moveDraggedLayer(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = dragState.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const ratio = 600 / current.cardWidth;
    const nextX = Math.min(
      160,
      Math.max(-160, current.startX + (event.clientX - current.startClientX) * ratio),
    );
    const nextY = Math.min(
      160,
      Math.max(-160, current.startY + (event.clientY - current.startClientY) * ratio),
    );
    setDraft((value) => {
      if (current.layer === 'photo') return { ...value, photoX: nextX, photoY: nextY };
      if (current.layer === 'rating') return { ...value, ratingX: nextX, ratingY: nextY };
      if (current.layer === 'identity') return { ...value, identityX: nextX, identityY: nextY };
      return { ...value, statsX: nextX, statsY: nextY };
    });
  }

  function endLayerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = dragState.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragState.current = null;
    const moved =
      Math.abs(event.clientX - current.startClientX) > 1 ||
      Math.abs(event.clientY - current.startClientY) > 1;
    if (!moved) return;
    setHistoryPast((history) => [...history, current.baseDraft].slice(-50));
    setHistoryFuture([]);
    setNotice('Camada reposicionada no Playground.');
  }

  function resetLayerPosition(layer: MovableLayer) {
    if (layer === 'photo') {
      commitDraft({ ...draft, photoX: 0, photoY: 0 });
      return;
    }
    if (layer === 'rating') {
      commitDraft({ ...draft, ratingX: 0, ratingY: 0 });
      return;
    }
    if (layer === 'identity') {
      commitDraft({ ...draft, identityX: 0, identityY: 0 });
      return;
    }
    commitDraft({ ...draft, statsX: 0, statsY: 0 });
  }

  function toggleFocusMode() {
    setFocusMode((current) => {
      if (current) {
        setRightOpen(true);
      } else {
        setRightOpen(false);
      }
      setFocusReveal(null);
      return !current;
    });
  }

  function openCommandPalette() {
    setCommandQuery('');
    setCommandPaletteOpen(true);
    window.setTimeout(() => commandSearchRef.current?.focus());
  }

  function openPlayerBrowser() {
    setFocusMode(false);
    setFocusReveal(null);
    window.setTimeout(() => playerBrowserSearchRef.current?.focus());
  }

  function runCommand(action: () => void) {
    setCommandPaletteOpen(false);
    action();
  }
  async function exportCard() {
    if (!qualityReady || !svgRef.current) return;
    const { width, height } = exportSize;
    setExporting(true);
    setNotice(`Compondo ${selectedAsset.label} em ${width} × ${height}…`);
    try {
      const [cardImage, playerImage] = await Promise.all([
        loadStudioCard(svgRef.current, exportOptions.assetKind, draft),
        exportOptions.assetKind === 'player-image'
          ? loadRemoteImage(draft.playerImageUrl)
          : Promise.resolve(null),
      ]);
      const canvas = composeStudioAsset({
        cardImage,
        draft,
        height,
        includeShadow: exportOptions.includeShadow,
        kind: exportOptions.assetKind,
        playerImage,
        transparentBackground: selectedAsset.transparent && exportOptions.transparentBackground,
        width,
      });
      const mime = exportOptions.format === 'webp' ? 'image/webp' : 'image/png';
      const quality = exportOptions.optimizeDiscord
        ? 0.82
        : exportOptions.highQuality
          ? 0.96
          : 0.88;
      const output = await canvasBlob(canvas, mime, quality);
      const outputUrl = URL.createObjectURL(output);
      const link = document.createElement('a');
      link.href = outputUrl;
      link.download = `${fileSlug(draft.name)}-${selectedAsset.id}-${width}x${height}.${exportOptions.format}`;
      link.click();
      URL.revokeObjectURL(outputUrl);
      setExportOpen(false);
      setNotice(`${selectedAsset.label} exportada em ${exportOptions.format.toUpperCase()}.`);
    } catch (error) {
      setNotice(`Falha ao exportar: ${message(error)}`);
    } finally {
      setExporting(false);
    }
  }

  const stageStyle = {
    '--studio-collection-primary': draft.primaryColor,
    '--studio-collection-secondary': draft.secondaryColor,
  } as CSSProperties;
  const liveCard = (
    <StudioCardPreview
      activeLayer={activeLayer}
      draft={draft}
      key={selectedCardId || draft.playerImageUrl || draft.name}
      onDragEnd={endLayerDrag}
      onDragMove={moveDraggedLayer}
      onDragStart={beginLayerDrag}
      onSelectLayer={selectLayer}
      playground={playground}
      showGuides={showGuides}
      svgRef={svgRef}
    />
  );
  const activeLayerDefinition = activeLayer
    ? (layerDefinitions.find((definition) => definition.id === activeLayer) ?? null)
    : null;
  const activeLayerIsMovable =
    activeLayer !== null && movableLayers.includes(activeLayer as MovableLayer);
  const photoHealth = healthChecks.find((check) => check.id === 'photo')?.status ?? 'blocked';
  const shieldHealth = healthChecks.find((check) => check.id === 'shield')?.status ?? 'blocked';
  const dataHealth = !selectedCardId
    ? 'blocked'
    : healthChecks.some(
          (check) => (check.id === 'name' || check.id === 'stats') && check.status === 'blocked',
        )
      ? 'blocked'
      : healthChecks.some(
            (check) => (check.id === 'name' || check.id === 'stats') && check.status === 'warning',
          )
        ? 'warning'
        : 'ready';
  const visualHealth = !selectedCardId
    ? 'blocked'
    : healthChecks.some(
          (check) =>
            (check.id === 'collection' || check.id === 'contrast' || check.id === 'layers') &&
            check.status === 'blocked',
        )
      ? 'blocked'
      : healthChecks.some(
            (check) =>
              (check.id === 'collection' || check.id === 'contrast' || check.id === 'layers') &&
              check.status === 'warning',
          )
        ? 'warning'
        : 'ready';
  const cardDna = [
    {
      id: 'photo',
      label: 'Foto',
      detail: !selectedCardId
        ? 'Escolha um jogador'
        : playerPhotoReady
          ? 'Recorte pronto'
          : 'Padronizar recorte',
      panel: 'photo' as const,
      status: photoHealth,
    },
    {
      id: 'shield',
      label: 'Escudo',
      detail: !selectedCardId
        ? 'Escolha um jogador'
        : teamLogoReady
          ? 'SVG pronto'
          : 'Corrigir no acervo',
      panel: 'data' as const,
      status: shieldHealth,
    },
    {
      id: 'data',
      label: 'Dados',
      detail: !selectedCardId
        ? 'Escolha um jogador'
        : dataHealth === 'ready'
          ? 'Campos revisados'
          : 'Revisar campos',
      panel: 'data' as const,
      status: dataHealth,
    },
    {
      id: 'visual',
      label: 'Visual',
      detail: !selectedCardId
        ? 'Escolha um jogador'
        : visualHealth === 'ready'
          ? 'Composição pronta'
          : 'Revisar composição',
      panel: 'visual' as const,
      status: visualHealth,
    },
  ];
  const showRightPanel = rightOpen || (focusMode && focusReveal === 'right');
  const commandActions = [
    {
      id: 'advanced-management',
      label: 'Gestão avançada',
      detail: 'Abra o catálogo de cards para editar os dados de origem.',
      run: () => navigate('/app/gerenciar/cards'),
    },
    {
      id: 'search-player',
      label: 'Buscar jogador',
      detail: 'Abra a seleção de card e escolha outro ponto de partida.',
      run: openPlayerBrowser,
    },
    {
      id: 'random-card',
      label: 'Gerar card aleatório',
      detail: 'Use outro jogador como ponto de partida.',
      run: randomCard,
    },
    {
      id: 'change-image',
      label: 'Alterar imagem',
      detail: 'Abra os ajustes da foto selecionada.',
      run: () => {
        setFocusMode(false);
        setFocusReveal(null);
        setPanel('photo');
        setRightOpen(true);
      },
    },
    {
      id: 'treat-image',
      label: 'Aplicar tratamento',
      detail: 'Abra o laboratório visual de imagem.',
      run: () => setWorkspace('image'),
    },
    {
      id: 'duplicate-creation',
      label: 'Duplicar criação',
      detail: 'Salve uma cópia da versão atual antes de experimentar.',
      run: () => createSnapshot(`Cópia · ${draft.name}`),
    },
    {
      id: 'suggest-stats',
      label: 'Sugerir stats',
      detail: 'Equilibre atributos pela posição e overall.',
      run: applySuggestedStats,
    },
    {
      id: 'randomize-visual',
      label: 'Randomizar visual',
      detail: 'Aplique outro tratamento da coleção.',
      run: randomizeVisual,
    },
    {
      id: 'export',
      label: 'Exportar',
      detail: 'Escolha formato, resolução e composição.',
      run: () => setExportOpen(true),
    },
  ];
  const visibleCommandActions = commandActions.filter((action) =>
    `${action.label} ${action.detail}`
      .toLocaleLowerCase()
      .includes(commandQuery.toLocaleLowerCase()),
  );
  const selectionToolbar =
    activeLayer && activeLayerDefinition ? (
      <div
        className="studio-selection-toolbar"
        aria-label={`Ações para ${activeLayerDefinition.label}`}
      >
        <span>{activeLayerDefinition.label}</span>
        <button onClick={clearLayerSelection} type="button">
          Fechar
        </button>
        {activeLayerIsMovable && (
          <button onClick={() => resetLayerPosition(activeLayer as MovableLayer)} type="button">
            Centralizar
          </button>
        )}
        <button onClick={() => toggleLayerLock(activeLayer)} type="button">
          {draft.layerLocks[activeLayer] ? 'Desbloquear' : 'Bloquear'}
        </button>
      </div>
    ) : null;

  return (
    <section className="studio-page card-studio-page" aria-labelledby="studio-title">
      <StudioHeader className="pack-studio-topbar studio-page-header">
        <div className="pack-studio-brand">
          <AdminIcon className="pack-studio-brand__mark" name="studio" />
          <div>
            <h1 id="studio-title">Studio de Cards</h1>
            <output className="pack-studio-save-state">
              {draft.name || 'Novo card'} ·{' '}
              {autosaveState === 'saving'
                ? 'Salvando rascunho local'
                : autosaveState === 'error'
                  ? 'Falha ao salvar rascunho local'
                  : 'Rascunho local salvo'}
            </output>
          </div>
        </div>
        <div className="pack-studio-topbar__actions">
          <button
            className="text-button"
            onClick={() => navigate('/app/gerenciar/cards')}
            type="button"
          >
            Gestão avançada
          </button>
          <button className="text-button" onClick={openPlayerBrowser} type="button">
            Trocar card
          </button>
          <button
            className="ops-button secondary"
            onClick={() => setWorkspace(workspace === 'image' ? 'cards' : 'image')}
            type="button"
          >
            {workspace === 'image' ? 'Voltar ao studio' : 'Tratar imagem'}
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
            disabled={
              !selectedCardId || !qualityReady || savingCardImage || autosaveState === 'saving'
            }
            onClick={() => void saveCardImage()}
            type="button"
          >
            {savingCardImage ? 'Salvando...' : 'Salvar imagem'}
          </button>
        </div>
      </StudioHeader>

      {workspace === 'image' ? (
        <div className="card-studio-image-workspace" id="studio-image-panel">
          <ImageTreatment
            source={
              draft.playerImageUrl
                ? { fileName: `Foto de ${draft.name}`, url: draft.playerImageUrl }
                : undefined
            }
            onApply={(imageUrl) => {
              if (localPhotoUrl.current) URL.revokeObjectURL(localPhotoUrl.current);
              localPhotoUrl.current = imageUrl;
              commitDraft(
                { ...draft, photoFormat: 'png', photoIsStandard: true, playerImageUrl: imageUrl },
                'Imagem tratada aplicada no card.',
              );
              setPanel('photo');
              setWorkspace('cards');
            }}
          />
        </div>
      ) : (
        <StudioWorkspace className="card-studio-workspace" id="studio-cards-panel">
          <StudioCanvas className="card-studio-canvas">
            <div
              className="studio-workbench"
              data-focus={focusMode}
              data-left="closed"
              data-right={showRightPanel ? 'open' : 'closed'}
            >
              <main
                className={`studio-stage ${exporting ? 'is-exporting' : ''}`}
                style={stageStyle}
              >
                {focusMode && (
                  <button
                    aria-label="Mostrar ajustes"
                    className="studio-focus-edge studio-focus-edge--right"
                    onFocus={() => setFocusReveal('right')}
                    onMouseEnter={() => setFocusReveal('right')}
                    type="button"
                  />
                )}
                <header className="studio-stage-bar">
                  <div className="studio-stage-left">
                    <button
                      className="studio-panel-reveal"
                      onClick={openPlayerBrowser}
                      type="button"
                    >
                      Trocar card
                    </button>
                    <span className="studio-live-dot" />
                    <strong>{playground ? 'Playground ao vivo' : 'Prévia master'}</strong>
                  </div>
                  <fieldset className="studio-preview-modes">
                    <legend className="sr-only">Modo de preview</legend>
                    {previewModes.map((mode) => (
                      <button
                        aria-pressed={previewMode === mode.id}
                        key={mode.id}
                        onClick={() => setPreviewMode(mode.id)}
                        type="button"
                      >
                        {mode.label}
                      </button>
                    ))}
                  </fieldset>
                  <div className="studio-stage-actions">
                    <button
                      aria-pressed={showGuides}
                      onClick={() => setShowGuides((visible) => !visible)}
                      type="button"
                    >
                      {showGuides ? 'Sem guias' : 'Guias'}
                    </button>
                    {!showRightPanel && (
                      <button
                        className="studio-panel-reveal"
                        onClick={() => {
                          if (focusMode) setFocusReveal('right');
                          else setRightOpen(true);
                        }}
                        type="button"
                      >
                        ‹ Ajustes
                      </button>
                    )}
                  </div>
                </header>

                <div className={`studio-canvas-shell mode-${previewMode}`}>
                  {exporting && (
                    <div aria-live="polite" className="studio-export-composition">
                      <i />
                      <strong>Compondo camadas</strong>
                      <span>Background · Effects · Photo · Type</span>
                    </div>
                  )}
                  {compareDraft ? (
                    <div className="studio-compare-view">
                      <header>
                        <span>Comparação visual</span>
                        <button onClick={() => setCompareDraft(null)} type="button">
                          Fechar compare
                        </button>
                      </header>
                      <div>
                        <figure>
                          <figcaption>{compareLabel}</figcaption>
                          <StudioCardPreview
                            activeLayer={null}
                            draft={compareDraft}
                            playground={false}
                            showGuides={false}
                            svgRef={undefined}
                          />
                        </figure>
                        <figure>
                          <figcaption>Atual</figcaption>
                          {liveCard}
                        </figure>
                      </div>
                    </div>
                  ) : (
                    <PreviewSurface mode={previewMode} toolbar={selectionToolbar} zoom={zoom}>
                      {liveCard}
                    </PreviewSurface>
                  )}
                </div>

                <section aria-label="Conferência do card" className="card-studio-proof">
                  <div className="card-studio-proof__heading">
                    <strong>Conferência</strong>
                    <span>
                      {!selectedCardId
                        ? 'Escolha um jogador'
                        : qualityReady
                          ? 'Pronto para salvar'
                          : 'Revise antes de salvar'}
                    </span>
                  </div>
                  <div className="card-studio-proof__checks">
                    {cardDna.map((check) => {
                      const content = (
                        <span className="card-studio-proof__content" key={check.id}>
                          <span className="card-studio-proof__status" aria-hidden="true">
                            {check.status === 'ready' ? '✓' : '!'}
                          </span>
                          <span className="card-studio-proof__copy">
                            <strong>{check.label}</strong>
                            <small>{check.detail}</small>
                          </span>
                          <span className="sr-only">
                            {check.status === 'ready'
                              ? 'Pronto'
                              : check.status === 'warning'
                                ? 'Atenção'
                                : 'Pendente'}
                          </span>
                        </span>
                      );
                      return check.id === 'shield' && selectedCardId && !teamLogoReady ? (
                        <Link
                          className="card-studio-proof__check"
                          data-status={check.status}
                          key={check.id}
                          to="/app/gerenciar/cards"
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          className="card-studio-proof__check"
                          data-status={check.status}
                          key={check.id}
                          onClick={() =>
                            selectedCardId ? openProofCheck(check.panel) : openPlayerBrowser()
                          }
                          type="button"
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {notice && (
                  <p aria-live="polite" className="studio-notice">
                    {notice}
                  </p>
                )}
              </main>

              <div className="studio-commandbar">
                <div className="studio-history-actions">
                  <button disabled={!historyPast.length} onClick={undoDraft} type="button">
                    <span aria-hidden="true">←</span> Undo
                  </button>
                  <button disabled={!historyFuture.length} onClick={redoDraft} type="button">
                    Redo <span aria-hidden="true">→</span>
                  </button>
                  <div className="studio-history-menu">
                    <button
                      aria-expanded={historyOpen}
                      className={historyOpen ? 'is-active' : ''}
                      onClick={() => setHistoryOpen((open) => !open)}
                      type="button"
                    >
                      Histórico <b>{snapshots.length}</b>
                    </button>
                    {historyOpen && (
                      <div className="studio-history-popover">
                        <header>
                          <div>
                            <strong>Snapshots</strong>
                            <small>Compare ou restaure versões desta criação.</small>
                          </div>
                          <button
                            aria-label="Fechar histórico"
                            onClick={() => setHistoryOpen(false)}
                            type="button"
                          >
                            ×
                          </button>
                        </header>
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            createSnapshot();
                          }}
                        >
                          <input
                            maxLength={32}
                            onChange={(event) => setSnapshotName(event.target.value)}
                            placeholder={`Versão ${snapshots.length + 1}`}
                            value={snapshotName}
                          />
                          <button type="submit">Salvar snapshot</button>
                        </form>
                        <div className="studio-snapshot-list">
                          <div className="studio-snapshot-row">
                            <span>
                              <strong>Original do banco</strong>
                              <small>Base do Smart Fill</small>
                            </span>
                            <button
                              onClick={() => {
                                setCompareDraft(originalDraft.current);
                                setCompareLabel('Original do banco');
                                setHistoryOpen(false);
                              }}
                              type="button"
                            >
                              Comparar
                            </button>
                            <button
                              onClick={() =>
                                commitDraft(originalDraft.current, 'Original do banco restaurado.')
                              }
                              type="button"
                            >
                              Restaurar
                            </button>
                          </div>
                          {snapshots.map((snapshot) => (
                            <div className="studio-snapshot-row" key={snapshot.id}>
                              <span>
                                <strong>{snapshot.name}</strong>
                                <small>{formatTime(snapshot.createdAt)}</small>
                              </span>
                              <button
                                onClick={() => {
                                  setCompareDraft(snapshot.draft);
                                  setCompareLabel(snapshot.name);
                                  setHistoryOpen(false);
                                }}
                                type="button"
                              >
                                Comparar
                              </button>
                              <button
                                onClick={() =>
                                  commitDraft(
                                    snapshot.draft,
                                    `Snapshot “${snapshot.name}” restaurado.`,
                                  )
                                }
                                type="button"
                              >
                                Restaurar
                              </button>
                            </div>
                          ))}
                          {!snapshots.length && (
                            <p>Salve uma versão antes de experimentar outro tratamento.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="studio-mode-actions">
                  <button
                    className="studio-command-palette-trigger"
                    onClick={openCommandPalette}
                    type="button"
                  >
                    Ações <kbd>Ctrl K</kbd>
                  </button>
                  {playground && (
                    <button
                      className="studio-restore-button"
                      onClick={restorePlaygroundBase}
                      type="button"
                    >
                      Restaurar entrada
                    </button>
                  )}
                  <button
                    aria-pressed={playground}
                    className={
                      playground ? 'studio-playground-toggle is-active' : 'studio-playground-toggle'
                    }
                    onClick={togglePlayground}
                    type="button"
                  >
                    <i /> Playground
                  </button>
                  <button aria-pressed={focusMode} onClick={toggleFocusMode} type="button">
                    {focusMode ? 'Sair do modo criação' : 'Modo criação'}
                  </button>
                </div>
              </div>

              {showRightPanel && (
                <StudioSidebar
                  aria-label="Opções do card"
                  className="studio-inspector"
                  onMouseLeave={() => {
                    if (focusMode)
                      setFocusReveal((current) => (current === 'right' ? null : current));
                  }}
                >
                  <header>
                    <div>
                      <h2>
                        {activeLayerDefinition?.label ??
                          (playground ? 'Edição livre' : 'Card em criação')}
                      </h2>
                    </div>
                    <div className="studio-inspector-actions">
                      {activeLayer && (
                        <button
                          aria-label="Mostrar configurações gerais do card"
                          onClick={() => {
                            setActiveLayer(null);
                            setPanel('data');
                          }}
                          type="button"
                        >
                          Card
                        </button>
                      )}
                      <button
                        aria-label="Recolher painel de ajustes"
                        onClick={() => {
                          setRightOpen(false);
                          setFocusMode(false);
                          setFocusReveal(null);
                        }}
                        type="button"
                      >
                        ›
                      </button>
                    </div>
                  </header>
                  <div
                    className="command-tabs studio-inspector-tabs"
                    role="tablist"
                    aria-label="Ajustes do Studio"
                  >
                    {inspectorTabs.map((tab) => (
                      <button
                        className="command-tab"
                        aria-selected={panel === tab.id}
                        key={tab.id}
                        onClick={() => {
                          setActiveLayer(null);
                          setPanel(tab.id);
                        }}
                        role="tab"
                        type="button"
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="studio-inspector-body">
                    {panel === 'data' && (
                      <div className="studio-control-stack" role="tabpanel">
                        {activeLayer === null && smartFillCount > 0 && (
                          <div className="studio-smart-fill">
                            <i />
                            <div>
                              <strong>Smart Fill concluído</strong>
                              <p>
                                {smartFillCount} campos encontrados no banco. Revise antes de
                                publicar.
                              </p>
                            </div>
                          </div>
                        )}
                        <section className="studio-data-section">
                          <header>
                            <span>Identidade</span>
                          </header>
                          {(activeLayer === null || activeLayer === 'identity') && (
                            <label>
                              Nome no card
                              <input
                                maxLength={24}
                                onChange={(event) => updateDraft('name', event.target.value)}
                                ref={nameInputRef}
                                value={draft.name}
                              />
                              <small>{draft.name.length}/24 · ajuste automático após 20</small>
                            </label>
                          )}
                          {(activeLayer === null || activeLayer === 'rating') && (
                            <div className="studio-form-row">
                              <label>
                                Overall
                                <input
                                  max={100}
                                  min={60}
                                  onChange={(event) =>
                                    updateDraft(
                                      'overall',
                                      Math.min(100, Math.max(60, Number(event.target.value))),
                                    )
                                  }
                                  ref={overallInputRef}
                                  type="number"
                                  value={draft.overall}
                                />
                              </label>
                              <label>
                                Posição
                                <select
                                  onChange={(event) => updateDraft('position', event.target.value)}
                                  value={draft.position}
                                >
                                  {positions.map((position) => (
                                    <option key={position}>{position}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          )}
                        </section>
                        <section className="studio-data-section">
                          <header>
                            <span>Atributos</span>
                          </header>
                          {(activeLayer === null || activeLayer === 'stats') && (
                            <>
                              <div className="studio-stats-heading">
                                <span>Stats do card</span>
                                <button onClick={applySuggestedStats} type="button">
                                  Sugerir por posição
                                </button>
                              </div>
                              <fieldset className="studio-stats-fieldset">
                                <legend className="sr-only">Stats do card</legend>
                                <div>
                                  {statFields.map(([key, label, code], index) => (
                                    <label key={key}>
                                      <span>
                                        {label} <b>{code}</b>
                                      </span>
                                      <input
                                        max={100}
                                        min={1}
                                        onChange={(event) =>
                                          updateDraft(
                                            key,
                                            Math.min(100, Math.max(1, Number(event.target.value))),
                                          )
                                        }
                                        ref={index === 0 ? firstStatInputRef : undefined}
                                        type="number"
                                        value={draft[key]}
                                      />
                                    </label>
                                  ))}
                                </div>
                              </fieldset>
                            </>
                          )}
                        </section>
                        <section className="studio-data-section">
                          <header>
                            <span>Vínculos</span>
                          </header>
                          {(activeLayer === null || activeLayer === 'badges') && (
                            <div className="studio-locked-links">
                              <span>
                                <small>Time</small>
                                <strong>{draft.teamName}</strong>
                              </span>
                              <span>
                                <small>Coleção</small>
                                <strong>{draft.collectionName}</strong>
                              </span>
                              <em>Vínculos controlados pelo card de origem</em>
                            </div>
                          )}
                        </section>
                      </div>
                    )}

                    {panel === 'photo' && (
                      <div className="studio-control-stack" role="tabpanel">
                        <div className="studio-control-intro">
                          <strong>Foto do jogador</strong>
                          <p>
                            Busca recortes e renders PNG, além de fotos JPEG, no TheSportsDB. No
                            Playground, arraste a foto direto no canvas.
                          </p>
                        </div>
                        <label className="studio-photo-search">
                          Buscar jogador
                          <input
                            autoComplete="off"
                            onChange={(event) => setPhotoQuery(event.target.value)}
                            placeholder="Ex.: Neymar"
                            ref={photoSearchRef}
                            type="search"
                            value={photoQuery}
                          />
                        </label>
                        <div aria-busy={photosLoading} className="studio-photo-results">
                          {photosLoading ? (
                            <div className="studio-list-state">Buscando fotos…</div>
                          ) : photoSuggestions.length ? (
                            photoSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.id}
                                onClick={() => choosePhoto(suggestion)}
                                type="button"
                              >
                                <img alt="" src={suggestion.imageUrl} />
                                <span>
                                  <strong>{suggestion.name}</strong>
                                  <small>
                                    {suggestion.provider}
                                    {suggestion.team && ` · ${suggestion.team}`}
                                  </small>
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="studio-list-state">
                              Busque pelo nome completo do jogador.
                            </div>
                          )}
                        </div>
                        <button
                          className="studio-replace-card-image"
                          disabled={!selectedCardId || !qualityReady || savingCardImage}
                          onClick={() => void saveCardImage()}
                          type="button"
                        >
                          {savingCardImage ? 'Salvando imagem…' : 'Salvar imagem do card'}
                        </button>
                        <p className="studio-replace-card-image-hint">
                          Salva o card renderizado em PNG no jogador selecionado.
                        </p>
                        <button
                          className="studio-upload-button"
                          onClick={() => setWorkspace('image')}
                          type="button"
                        >
                          {playerPhotoSelected
                            ? 'Ajustar recorte no laboratório'
                            : 'Enviar e padronizar foto'}
                        </button>
                        <div className="studio-range-group">
                          <label>
                            <span>
                              Escala <output>{draft.photoScale}%</output>
                            </span>
                            <input
                              max={145}
                              min={70}
                              onChange={(event) =>
                                updateDraft('photoScale', Number(event.target.value))
                              }
                              type="range"
                              value={draft.photoScale}
                            />
                          </label>
                          <label>
                            <span>
                              Horizontal <output>{Math.round(draft.photoX)}</output>
                            </span>
                            <input
                              max={160}
                              min={-160}
                              onChange={(event) =>
                                updateDraft('photoX', Number(event.target.value))
                              }
                              type="range"
                              value={draft.photoX}
                            />
                          </label>
                          <label>
                            <span>
                              Vertical <output>{Math.round(draft.photoY)}</output>
                            </span>
                            <input
                              max={160}
                              min={-160}
                              onChange={(event) =>
                                updateDraft('photoY', Number(event.target.value))
                              }
                              type="range"
                              value={draft.photoY}
                            />
                          </label>
                        </div>
                        <div className="studio-source-credit">
                          Fonte:{' '}
                          <a href="https://www.thesportsdb.com" rel="noreferrer" target="_blank">
                            TheSportsDB
                          </a>
                        </div>
                      </div>
                    )}

                    {panel === 'visual' && (
                      <div className="studio-control-stack" role="tabpanel">
                        <div className="studio-control-intro">
                          <strong>Design do card</strong>
                          <p>
                            Modele a base, escolha o metal e personalize os detalhes da sua edição.
                          </p>
                        </div>
                        <CardDesignFields
                          design={draft.design}
                          onChange={(design) => updateDraft('design', design)}
                        />
                        <fieldset className="studio-preset-grid">
                          <legend>Background presets</legend>
                          {stylePresets.map((preset) => (
                            <label key={preset.id}>
                              <input
                                checked={
                                  draft.primaryColor === preset.primaryColor &&
                                  draft.secondaryColor === preset.secondaryColor
                                }
                                name="studioPreset"
                                onChange={() => applyPreset(preset)}
                                type="radio"
                              />
                              <span>
                                <i
                                  style={{
                                    background: `linear-gradient(135deg, ${preset.primaryColor}, ${preset.secondaryColor})`,
                                  }}
                                />
                                <strong>{preset.label}</strong>
                                <small>{preset.description}</small>
                              </span>
                            </label>
                          ))}
                        </fieldset>
                        <fieldset className="studio-chip-picker">
                          <legend>Tratamento</legend>
                          {(
                            [
                              ['elite', 'Elite Aqua'],
                              ['signature', 'Assinatura'],
                              ['midnight', 'Noturno'],
                              ['velocity', 'Velocidade'],
                            ] as const
                          ).map(([id, label]) => (
                            <label key={id}>
                              <input
                                checked={draft.style === id}
                                name="cardStyle"
                                onChange={() => updateDraft('style', id)}
                                type="radio"
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </fieldset>
                        <fieldset className="studio-chip-picker finish-picker">
                          <legend>Acabamento</legend>
                          {finishOptions.map((finish) => (
                            <label key={finish.id}>
                              <input
                                checked={draft.finish === finish.id}
                                name="cardFinish"
                                onChange={() => updateDraft('finish', finish.id)}
                                type="radio"
                              />
                              <span>{finish.label}</span>
                            </label>
                          ))}
                        </fieldset>
                        <fieldset className="studio-chip-picker rarity-picker">
                          <legend>Raridade</legend>
                          {rarityOptions.map((rarity) => (
                            <label key={rarity.id}>
                              <input
                                checked={draft.rarity === rarity.id}
                                name="cardRarity"
                                onChange={() => updateDraft('rarity', rarity.id)}
                                type="radio"
                              />
                              <span data-rarity={rarity.id}>{rarity.label}</span>
                            </label>
                          ))}
                        </fieldset>
                        <div className="studio-color-row">
                          <label>
                            Cor principal
                            <input
                              onChange={(event) => updateDraft('primaryColor', event.target.value)}
                              type="color"
                              value={draft.primaryColor}
                            />
                          </label>
                          <label>
                            Cor de contraste
                            <input
                              onChange={(event) =>
                                updateDraft('secondaryColor', event.target.value)
                              }
                              type="color"
                              value={draft.secondaryColor}
                            />
                          </label>
                        </div>
                        <div className="studio-visual-actions">
                          <button onClick={randomizeVisual} type="button">
                            Randomizar visual
                          </button>
                          <button onClick={restoreCollectionDefaults} type="button">
                            Padrão da coleção
                          </button>
                        </div>
                      </div>
                    )}

                    {panel === 'layers' && (
                      <div className="studio-control-stack" role="tabpanel">
                        <div className="studio-control-intro">
                          <strong>Layers</strong>
                          <p>
                            Topo da lista aparece à frente no card. Ocultar e reordenar também afeta
                            a exportação.
                          </p>
                        </div>
                        <div className="studio-layer-list">
                          <div className="studio-layer-root">
                            <span aria-hidden="true">⌄</span>
                            <strong>Card</strong>
                            <small>Composição final</small>
                          </div>
                          {layerGroups.map((group) => {
                            const layers = [...draft.layerOrder]
                              .reverse()
                              .filter((layer) => group.layers.includes(layer));
                            return (
                              <section className="studio-layer-group" key={group.label}>
                                <p>
                                  <span aria-hidden="true">⌄</span>
                                  {group.label}
                                </p>
                                {layers.map((layer) => {
                                  const definition = layerDefinitions.find(
                                    (entry) => entry.id === layer,
                                  );
                                  const orderIndex = draft.layerOrder.indexOf(layer);
                                  return (
                                    <div
                                      className={
                                        activeLayer === layer
                                          ? 'studio-layer-row is-active'
                                          : 'studio-layer-row'
                                      }
                                      draggable
                                      key={layer}
                                      onDragEnd={() => setDraggedLayer(null)}
                                      onDragOver={(event) => event.preventDefault()}
                                      onDragStart={(event) => startLayerReorder(event, layer)}
                                      onDrop={(event) => completeLayerReorder(event, layer)}
                                    >
                                      <span aria-hidden="true" className="studio-layer-drag">
                                        ⋮⋮
                                      </span>
                                      <button
                                        aria-label={
                                          draft.layerVisibility[layer]
                                            ? `Ocultar ${definition?.label}`
                                            : `Mostrar ${definition?.label}`
                                        }
                                        aria-pressed={draft.layerVisibility[layer]}
                                        className="studio-layer-visibility"
                                        onClick={() => toggleLayerVisibility(layer)}
                                        type="button"
                                      >
                                        {draft.layerVisibility[layer] ? 'Visível' : 'Oculta'}
                                      </button>
                                      <button
                                        className="studio-layer-name"
                                        onClick={() => selectLayer(layer)}
                                        type="button"
                                      >
                                        <strong>{definition?.label}</strong>
                                        <small>{definition?.description}</small>
                                      </button>
                                      <button
                                        aria-label={
                                          draft.layerLocks[layer]
                                            ? `Desbloquear ${definition?.label}`
                                            : `Bloquear ${definition?.label}`
                                        }
                                        aria-pressed={draft.layerLocks[layer]}
                                        className="studio-layer-lock"
                                        onClick={() => toggleLayerLock(layer)}
                                        type="button"
                                      >
                                        {draft.layerLocks[layer] ? 'Lock' : 'Livre'}
                                      </button>
                                      <span className="studio-layer-order">
                                        <button
                                          aria-label={`Subir ${definition?.label}`}
                                          disabled={orderIndex === draft.layerOrder.length - 1}
                                          onClick={() => reorderLayer(layer, 1)}
                                          type="button"
                                        >
                                          ↑
                                        </button>
                                        <button
                                          aria-label={`Descer ${definition?.label}`}
                                          disabled={orderIndex === 0}
                                          onClick={() => reorderLayer(layer, -1)}
                                          type="button"
                                        >
                                          ↓
                                        </button>
                                      </span>
                                    </div>
                                  );
                                })}
                              </section>
                            );
                          })}
                        </div>
                        {playground && (
                          <button
                            className="studio-reset-palette"
                            onClick={restoreCollectionDefaults}
                            type="button"
                          >
                            Restaurar grade e ordem da coleção
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </StudioSidebar>
              )}
            </div>
          </StudioCanvas>
          <StudioSidebar aria-labelledby="studio-card-picker-title" className="studio-card-picker">
            <header>
              <h2 id="studio-card-picker-title">Acervo</h2>
              <p>Escolha um jogador para começar.</p>
            </header>
            <label className="studio-search">
              <span className="sr-only">Buscar card</span>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="6" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                autoComplete="off"
                ref={playerBrowserSearchRef}
                onChange={(event) => setPlayerQuery(event.target.value)}
                placeholder="Nome, time ou coleção"
                type="search"
                value={playerQuery}
              />
            </label>
            <div className="studio-browser-filters" role="tablist" aria-label="Filtro de cards">
              {(
                [
                  ['all', 'Todos'],
                  ['recent', 'Recentes'],
                  ['favorites', 'Favoritos'],
                ] as const
              ).map(([id, label]) => (
                <button
                  aria-selected={browserFilter === id}
                  key={id}
                  onClick={() => setBrowserFilter(id)}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <div aria-busy={playersLoading} className="studio-card-picker-list">
              {playersLoading ? (
                <div className="studio-list-state">Buscando cards…</div>
              ) : visiblePlayers.length ? (
                visiblePlayers.map((card) => (
                  <button
                    aria-pressed={selectedCardId === card.id}
                    className="studio-card-picker-option"
                    key={card.id}
                    onClick={() => applyCard(card)}
                    type="button"
                  >
                    <span className="studio-player-thumb">
                      <img alt="" src={card.imageUrl} />
                    </span>
                    <span>
                      <strong>{card.name}</strong>
                      <small>
                        {card.team.name} · {card.position}
                      </small>
                    </span>
                    <b>{card.overall}</b>
                  </button>
                ))
              ) : (
                <div className="studio-list-state">
                  {browserFilter === 'favorites'
                    ? 'Nenhum favorito nesta busca.'
                    : 'Nenhum card encontrado.'}
                </div>
              )}
            </div>
          </StudioSidebar>

          {commandPaletteOpen && (
            <div className="studio-dialog-backdrop">
              <dialog
                aria-labelledby="studio-command-palette-title"
                aria-modal="true"
                className="studio-command-palette"
                open
              >
                <header>
                  <div>
                    <p className="eyebrow">Atalho de criação</p>
                    <h2 id="studio-command-palette-title">O que você quer fazer?</h2>
                  </div>
                  <button
                    aria-label="Fechar ações"
                    onClick={() => setCommandPaletteOpen(false)}
                    type="button"
                  >
                    ×
                  </button>
                </header>
                <label className="studio-command-search">
                  <span className="sr-only">Buscar ação</span>
                  <input
                    autoComplete="off"
                    onChange={(event) => setCommandQuery(event.target.value)}
                    placeholder="Buscar jogador, imagem ou exportação"
                    ref={commandSearchRef}
                    type="search"
                    value={commandQuery}
                  />
                </label>
                <div className="studio-command-list">
                  {visibleCommandActions.length ? (
                    visibleCommandActions.map((action) => (
                      <button key={action.id} onClick={() => runCommand(action.run)} type="button">
                        <span>
                          <strong>{action.label}</strong>
                          <small>{action.detail}</small>
                        </span>
                        <b tabIndex={-1} aria-hidden="true">
                          ↵
                        </b>
                      </button>
                    ))
                  ) : (
                    <p>Nenhuma ação encontrada.</p>
                  )}
                </div>
              </dialog>
            </div>
          )}
          {exportOpen && (
            <div className="studio-dialog-backdrop">
              <dialog aria-labelledby="studio-export-title" className="studio-export-dialog" open>
                <header>
                  <div>
                    <p className="eyebrow">Asset kit do jogador</p>
                    <h2 id="studio-export-title">Exportar imagens</h2>
                  </div>
                  <button
                    aria-label="Fechar exportação"
                    onClick={() => setExportOpen(false)}
                    type="button"
                  >
                    ×
                  </button>
                </header>
                <div className="studio-export-preview">
                  <StudioAssetPreview draft={draft} kind={selectedAsset.id} />
                  <div>
                    <small>{selectedAsset.label}</small>
                    <strong>
                      {fileSlug(draft.name)}-{selectedAsset.id}.{exportOptions.format}
                    </strong>
                    <span>
                      {exportSize.width} × {exportSize.height} px
                    </span>
                  </div>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void exportCard();
                  }}
                >
                  <fieldset className="studio-asset-types">
                    <legend>Tipo de imagem</legend>
                    {studioAssetDefinitions.map((asset) => {
                      const blocked = asset.id !== 'player-image' && !teamLogoReady;
                      return (
                        <label className={blocked ? 'is-disabled' : undefined} key={asset.id}>
                          <input
                            checked={selectedAsset.id === asset.id}
                            disabled={blocked}
                            name="assetKind"
                            onChange={() =>
                              setExportOptions((current) => ({
                                ...current,
                                assetKind: asset.id,
                                transparentBackground: asset.transparent,
                                width: asset.width,
                              }))
                            }
                            type="radio"
                          />
                          <span>
                            <i className="studio-asset-glyph" data-kind={asset.id}>
                              <b />
                              <b />
                            </i>
                            <strong>{asset.label}</strong>
                            <small>{asset.description}</small>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>

                  <div className="studio-export-settings">
                    <fieldset className="studio-export-format">
                      <legend>Formato</legend>
                      {(['png', 'webp'] as const).map((format) => (
                        <label key={format}>
                          <input
                            checked={exportOptions.format === format}
                            name="exportFormat"
                            onChange={() =>
                              setExportOptions((current) => ({
                                ...current,
                                format,
                                optimizeDiscord:
                                  format === 'webp' ? current.optimizeDiscord : false,
                              }))
                            }
                            type="radio"
                          />
                          <span>
                            <strong>{format.toUpperCase()}</strong>
                            <small>
                              {format === 'png' ? 'Transparência sem perdas' : 'Arquivo mais leve'}
                            </small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <fieldset className="studio-export-resolution">
                      <legend>Resolução</legend>
                      <button
                        aria-pressed={exportOptions.width === selectedAsset.width}
                        onClick={() =>
                          setExportOptions((current) => ({
                            ...current,
                            width: selectedAsset.width,
                          }))
                        }
                        type="button"
                      >
                        {selectedAsset.width} × {selectedAsset.height}
                      </button>
                      <button
                        aria-pressed={exportOptions.width === selectedAsset.width * 2}
                        onClick={() =>
                          setExportOptions((current) => ({
                            ...current,
                            width: selectedAsset.width * 2,
                          }))
                        }
                        type="button"
                      >
                        {studioAssetSize(selectedAsset.id, selectedAsset.width * 2).width} ×{' '}
                        {studioAssetSize(selectedAsset.id, selectedAsset.width * 2).height}
                      </button>
                      <label>
                        Largura customizada
                        <input
                          max={2400}
                          min={300}
                          onChange={(event) =>
                            setExportOptions((current) => ({
                              ...current,
                              width: Number(event.target.value),
                            }))
                          }
                          step={10}
                          type="number"
                          value={exportOptions.width}
                        />
                      </label>
                    </fieldset>
                  </div>

                  <fieldset className="studio-export-options">
                    <legend>Composição</legend>
                    <label className={!selectedAsset.transparent ? 'is-disabled' : undefined}>
                      <input
                        checked={selectedAsset.transparent && exportOptions.transparentBackground}
                        disabled={!selectedAsset.transparent}
                        onChange={(event) =>
                          setExportOptions((current) => ({
                            ...current,
                            transparentBackground: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      <span>
                        <strong>Fundo externo transparente</strong>
                        <small>
                          {selectedAsset.transparent
                            ? 'Preserva o recorte do asset.'
                            : 'Este formato inclui fundo editorial.'}
                        </small>
                      </span>
                    </label>
                    <label>
                      <input
                        checked={exportOptions.highQuality}
                        onChange={(event) =>
                          setExportOptions((current) => ({
                            ...current,
                            highQuality: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      <span>
                        <strong>Alta qualidade</strong>
                        <small>Reamostragem de imagem em qualidade máxima.</small>
                      </span>
                    </label>
                    <label>
                      <input
                        checked={exportOptions.includeShadow}
                        onChange={(event) =>
                          setExportOptions((current) => ({
                            ...current,
                            includeShadow: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      <span>
                        <strong>Incluir sombra</strong>
                        <small>Aplica profundidade no arquivo composto.</small>
                      </span>
                    </label>
                    <label>
                      <input
                        checked={exportOptions.optimizeDiscord}
                        onChange={(event) =>
                          setExportOptions((current) => ({
                            ...current,
                            format: event.target.checked ? 'webp' : current.format,
                            optimizeDiscord: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      <span>
                        <strong>Otimizar para Discord</strong>
                        <small>WebP com compressão visual de 82%.</small>
                      </span>
                    </label>
                  </fieldset>
                  <footer>
                    <button onClick={() => setExportOpen(false)} type="button">
                      Cancelar
                    </button>
                    <button
                      className="studio-generate-button"
                      disabled={exporting || savingCardImage || !qualityReady}
                      type="submit"
                    >
                      {exporting ? 'Compondo camadas…' : `Gerar ${selectedAsset.label}`}
                    </button>
                  </footer>
                </form>
              </dialog>
            </div>
          )}
        </StudioWorkspace>
      )}
    </section>
  );
}

function StudioAssetPreview({
  draft,
  kind,
}: Readonly<{ draft: StudioDraft; kind: StudioAssetKind }>) {
  const cardDraft =
    kind === 'simple-card'
      ? {
          ...draft,
          layerVisibility: {
            ...draft.layerVisibility,
            effects: false,
            badges: false,
            stats: false,
          },
        }
      : draft;
  const card = (
    <StudioCardPreview
      activeLayer={null}
      draft={cardDraft}
      playground={false}
      showGuides={false}
      svgRef={undefined}
    />
  );

  if (kind === 'player-image') {
    return (
      <div
        aria-label={`Recorte de ${draft.name}`}
        className="studio-asset-artboard is-player-image"
      >
        <img alt="" src={draft.playerImageUrl} />
      </div>
    );
  }

  const editorial = kind === 'social-image' || kind === 'share-image';
  return (
    <div
      aria-label={`Prévia: ${studioAssetDefinitions.find((asset) => asset.id === kind)?.label}`}
      className={`studio-asset-artboard is-${kind}`}
    >
      {editorial && <span className="studio-asset-kicker">FUTHUB / CARD REVEAL</span>}
      <div className="studio-export-card-slot">{card}</div>
      {kind === 'futgg-item' && (
        <div aria-hidden="true" className="studio-futgg-markers">
          <b>RB</b>
          <b>CB</b>
          <b>CDM</b>
          <b>LM</b>
        </div>
      )}
      {editorial && (
        <div className="studio-asset-copy">
          <small>
            {draft.overall} · {draft.position} · {draft.teamName}
          </small>
          <strong>{draft.name}</strong>
          <span>{draft.collectionName}</span>
          <div>
            {statFields.map(([key, _label, code]) => (
              <b key={key}>
                <i>{code}</i>
                {draft[key]}
              </b>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewSurface({
  children,
  mode,
  toolbar,
  zoom,
}: Readonly<{ children: ReactNode; mode: PreviewMode; toolbar: ReactNode; zoom: number }>) {
  const cardStyle = { '--studio-card-zoom': zoom / 100 } as CSSProperties;
  function updateTilt(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty('--studio-card-tilt-x', `${-y * 3}`);
    event.currentTarget.style.setProperty('--studio-card-tilt-y', `${x * 3}`);
    event.currentTarget.style.setProperty('--studio-card-glare-x', `${(x + 0.5) * 100}%`);
    event.currentTarget.style.setProperty('--studio-card-glare-y', `${(y + 0.5) * 100}%`);
  }
  function resetTilt(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.style.removeProperty('--studio-card-tilt-x');
    event.currentTarget.style.removeProperty('--studio-card-tilt-y');
    event.currentTarget.style.removeProperty('--studio-card-glare-x');
    event.currentTarget.style.removeProperty('--studio-card-glare-y');
  }
  if (mode === 'discord') {
    return (
      <div className="studio-discord-preview">
        <header>
          <i />
          <span>
            <b>FutHub</b>
            <small>BOT · agora</small>
          </span>
        </header>
        <p>Card pronto para entrar em campo.</p>
        <div className="studio-preview-card-slot" style={cardStyle}>
          {children}
        </div>
        <footer>Adicionar reação · Responder</footer>
      </div>
    );
  }
  if (mode === 'mobile') {
    return (
      <div className="studio-mobile-preview">
        <header>
          <span>9:41</span>
          <i />
        </header>
        <div>
          <small>FUTHUB · CARD REVEAL</small>
          <div className="studio-preview-card-slot" style={cardStyle}>
            {children}
          </div>
        </div>
        <footer>
          <i />
          <i />
          <i />
        </footer>
      </div>
    );
  }
  if (mode === 'artwork') {
    return (
      <div className="studio-artwork-preview">
        <span>FUTHUB / COLLECTION ARTWORK</span>
        <div className="studio-preview-card-slot" style={cardStyle}>
          {children}
        </div>
        <strong>
          THE GAME
          <br />
          IS YOURS.
        </strong>
      </div>
    );
  }
  return (
    <div className="studio-isolated-preview">
      <span className="studio-measure studio-measure-y">800 px</span>
      <div
        className="studio-preview-card-slot"
        onPointerLeave={resetTilt}
        onPointerMove={updateTilt}
        style={cardStyle}
      >
        {toolbar}
        {children}
      </div>
      <span className="studio-measure studio-measure-x">600 px</span>
    </div>
  );
}

function StudioCardPreview({
  activeLayer,
  draft,
  onDragEnd,
  onDragMove,
  onDragStart,
  onSelectLayer,
  playground,
  showGuides,
  svgRef,
}: Readonly<{
  activeLayer: LayerKey | null;
  draft: StudioDraft;
  onDragEnd?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDragStart?: (layer: MovableLayer, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onSelectLayer?: (layer: LayerKey) => void;
  playground: boolean;
  showGuides: boolean;
  svgRef: RefObject<SVGSVGElement | null> | undefined;
}>) {
  const [rendered, setRendered] = useState<Readonly<{
    draft: StudioDraft;
    src: string;
    model: boolean;
  }> | null>(null);
  const [renderError, setRenderError] = useState('');
  const currentRender = rendered?.draft === draft ? rendered : null;
  const modelImage = currentRender?.src ?? '';
  const instanceId = useId().replace(/:/g, '');
  useEffect(() => {
    const svg = svgRef?.current;
    if (!svg) return;
    let cancelled = false;
    setRenderError('');
    void loadStudioCard(svg, 'ea-fc-item', draft)
      .then((canvas) => {
        if (!cancelled)
          setRendered({
            draft,
            src: cardImageDataUrl(canvas),
            model: canvas instanceof HTMLCanvasElement,
          });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setRenderError(error instanceof Error ? error.message : 'Falha ao renderizar a arte.');
      });
    return () => {
      cancelled = true;
    };
  }, [draft, svgRef]);
  const ids = {
    ambient: `${instanceId}-ambient`,
    body: `${instanceId}-body`,
    clip: `${instanceId}-clip`,
    edge: `${instanceId}-edge`,
    fade: `${instanceId}-fade`,
    finish: `${instanceId}-finish`,
    frameGlow: `${instanceId}-frame-glow`,
    playerGlow: `${instanceId}-player-glow`,
    photoTone: `${instanceId}-photo-tone`,
    texture: `${instanceId}-texture`,
  };
  const framePath = cardFramePaths[draft.design.frame];
  const elite = draft.style === 'elite';
  const darkCard = draft.style !== 'velocity';
  const copyColor = elite ? '#f6e6a8' : darkCard ? '#f8fafc' : '#10141d';
  const mutedCopy = elite ? '#c9d8d7' : darkCard ? '#b7c2cf' : '#4b5563';
  const deepPanel = elite ? '#031225' : darkCard ? '#070c13' : '#eef2f6';
  const rarityLabel = rarityOptions.find((rarity) => rarity.id === draft.rarity)?.label ?? 'Rare';
  const rarityTier = Math.max(
    0,
    rarityOptions.findIndex((rarity) => rarity.id === draft.rarity),
  );
  const frameMetal = draft.design.metalColor;
  const playerSize = 600 * (draft.photoScale / 100);
  const playerX = (600 - playerSize) / 2 + draft.photoX;
  const playerY = 38 + (600 - playerSize) / 2 + draft.photoY;
  const nameText = draft.name.toLocaleUpperCase().slice(0, 24);
  const nameFontSize =
    ((draft.name.length > 20 ? 30 : draft.name.length > 16 ? 35 : 43) * draft.design.nameScale) /
    100;
  const motifPath = {
    elite: 'M54 408C128 208 472 208 546 408',
    signature: 'M-46 418C148 120 412 156 650 56',
    midnight: 'M82 392C142 170 458 170 518 392',
    velocity: 'M-20 430 632 108',
  }[draft.style];
  const highlightedStats = new Set<StatKey>(
    [...statFields]
      .sort((first, second) => draft[second[0]] - draft[first[0]])
      .slice(0, 3)
      .map(([key]) => key),
  );

  const layers: Record<LayerKey, ReactNode> = {
    background: (
      <g>
        {rarityTier >= 2 && (
          <path
            d={framePath}
            fill="none"
            filter={`url(#${ids.frameGlow})`}
            opacity={rarityTier >= 4 ? '0.48' : '0.28'}
            stroke={frameMetal}
            strokeWidth={rarityTier >= 4 ? '18' : '12'}
          />
        )}
        <path d={framePath} fill={`url(#${ids.body})`} />
        <path d={framePath} fill={`url(#${ids.ambient})`} opacity="0.72" />
        <g clipPath={`url(#${ids.clip})`}>
          <rect fill={`url(#${ids.fade})`} height="450" width="600" y="350" />
        </g>
        <path
          d={framePath}
          fill="none"
          opacity={draft.rarity === 'common' ? '0.5' : '0.74'}
          stroke={frameMetal}
          strokeWidth={draft.design.frameWidth}
        />
      </g>
    ),
    effects: (
      <g clipPath={`url(#${ids.clip})`}>
        <CardTexture design={draft.design} id={ids.texture} color={frameMetal} />
        <path
          d={motifPath}
          fill="none"
          opacity={draft.style === 'velocity' ? '0.2' : '0.14'}
          stroke={draft.secondaryColor}
          strokeLinecap="round"
          strokeWidth={draft.style === 'velocity' ? '76' : '44'}
        />
        {draft.photoFormat === 'png' && draft.playerImageUrl && (
          <image
            height="680"
            href={draft.playerImageUrl}
            opacity="0.075"
            preserveAspectRatio="xMidYMid meet"
            style={{ mixBlendMode: 'screen' }}
            width="680"
            x="-40"
            y="4"
          />
        )}
        {draft.finish !== 'matte' && (
          <path
            d="M-90 624 480-30 672 82 96 734Z"
            fill={`url(#${ids.finish})`}
            opacity={
              draft.finish === 'chrome' ? '0.24' : draft.finish === 'retro' ? '0.08' : '0.14'
            }
            style={{ mixBlendMode: draft.finish === 'chrome' ? 'screen' : 'color-dodge' }}
          />
        )}
      </g>
    ),
    photo: (
      <g clipPath={`url(#${ids.clip})`}>
        <ellipse
          cx="324"
          cy="336"
          fill={draft.secondaryColor}
          filter={`url(#${ids.playerGlow})`}
          opacity={draft.design.glow / 100}
          rx="168"
          ry="214"
        />
        {draft.playerImageUrl ? (
          <image
            className="studio-player-art"
            filter={`url(#${ids.photoTone})`}
            height={playerSize}
            href={draft.playerImageUrl}
            key={draft.playerImageUrl}
            preserveAspectRatio="xMidYMid meet"
            width={playerSize}
            x={playerX}
            y={playerY}
          />
        ) : (
          <g fill="#ffffff" opacity="0.18" transform={`translate(${draft.photoX} ${draft.photoY})`}>
            <circle cx="330" cy="208" r="88" />
            <path d="M142 594c10-166 82-252 188-252s178 86 188 252Z" />
          </g>
        )}
        <rect fill={`url(#${ids.fade})`} height="260" width="600" y="380" />
      </g>
    ),
    rating: (
      <g transform={`translate(${draft.ratingX} ${draft.ratingY})`}>
        <text
          fill={mutedCopy}
          fontFamily="JetBrains Mono, monospace"
          fontSize="10"
          fontWeight="600"
          letterSpacing="2.2"
          x="74"
          y="105"
        >
          OVERALL
        </text>
        <text
          className="studio-rating-number"
          fill={copyColor}
          fontFamily="Arial Narrow, Inter, sans-serif"
          fontSize="102"
          fontWeight="700"
          key={draft.overall}
          letterSpacing="-7"
          x="68"
          y="195"
        >
          {draft.overall}
        </text>
        <path d="M72 215H158" opacity="0.72" stroke={draft.secondaryColor} strokeWidth="3" />
        <text
          fill={copyColor}
          fontFamily="Arial Narrow, Inter, sans-serif"
          fontSize="28"
          fontWeight="700"
          letterSpacing="1.6"
          textAnchor="middle"
          x="114"
          y="249"
        >
          {draft.position}
        </text>
      </g>
    ),
    badges: (
      <g>
        <path
          d={framePath}
          fill="none"
          opacity="0.76"
          stroke={`url(#${ids.edge})`}
          strokeWidth={draft.design.frameWidth}
        />
        <path
          d={framePath}
          fill="none"
          opacity="0.4"
          stroke="#ffffff"
          strokeWidth="1.5"
          transform="translate(300 408) scale(.956 .958) translate(-300 -408)"
        />
        <g fill="none" stroke={frameMetal} opacity=".65">
          <path d="M62 370V430L82 452M538 370V430L518 452" strokeWidth="2" />
          <path d="M70 385V426L88 444M530 385V426L512 444" />
          <path d="m62 360 4-4-4-4-4 4Zm476 0 4-4-4-4-4 4Z" fill={frameMetal} />
        </g>
        {rarityTier >= 2 && draft.design.frame === 'crest' && (
          <path
            d="M222 56 248 24H352L378 56"
            fill="none"
            stroke={frameMetal}
            strokeLinecap="square"
            strokeWidth="7"
          />
        )}
        {draft.collectionLogoUrl ? (
          <image
            href={draft.collectionLogoUrl}
            x="284"
            y="45"
            width="32"
            height="32"
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <g transform="translate(300 62)" fill="none" stroke={frameMetal}>
            <path d="m0-15 13 8v14L0 15-13 7V-7Z" />
            <path d="M-5 7V-7H6M-5-1H3" strokeWidth="2" />
          </g>
        )}
        {rarityTier >= 3 && (
          <g fill="none" opacity="0.9" stroke={frameMetal} strokeWidth="5">
            <path d="m108 754 68 14" />
            <path d="m492 754-68 14" />
          </g>
        )}
        <g transform="translate(445 88)">
          <path d="M0 18H98" opacity="0.7" stroke={frameMetal} strokeWidth="2" />
          <text
            fill={copyColor}
            fontFamily="JetBrains Mono, monospace"
            fontSize="9"
            fontWeight="700"
            letterSpacing="1.6"
            textAnchor="end"
            x="98"
            y="10"
          >
            {rarityLabel.toLocaleUpperCase()}
          </text>
        </g>
        {draft.teamLogoUrl ? (
          <image
            height="72"
            href={draft.teamLogoUrl}
            preserveAspectRatio="xMidYMid meet"
            width="64"
            x="82"
            y="288"
          />
        ) : (
          <g transform="translate(89 292)">
            <path
              d="M25 0 50 10v22c0 22-15 35-25 41C15 67 0 54 0 32V10Z"
              fill={frameMetal}
              opacity="0.85"
            />
            <text
              fill={deepPanel}
              fontFamily="Inter, sans-serif"
              fontSize="12"
              fontWeight="800"
              textAnchor="middle"
              x="25"
              y="34"
            >
              {draft.teamName.slice(0, 2).toLocaleUpperCase()}
            </text>
          </g>
        )}
      </g>
    ),
    identity: (
      <g transform={`translate(${draft.identityX} ${draft.identityY})`}>
        <CardNameplate design={draft.design} panel={deepPanel} />
        <text
          fill={copyColor}
          fontFamily={
            draft.design.typography === 'classic'
              ? 'Georgia, serif'
              : 'Arial Narrow, Inter, sans-serif'
          }
          fontSize={nameFontSize}
          fontWeight="800"
          letterSpacing="-1.5"
          textAnchor="middle"
          textLength={nameText.length * nameFontSize * 0.66 > 432 ? 432 : undefined}
          lengthAdjust="spacingAndGlyphs"
          x="300"
          y="526"
        >
          {nameText}
        </text>
        <text
          fill={mutedCopy}
          fontFamily="JetBrains Mono, monospace"
          fontSize="9"
          fontWeight="600"
          letterSpacing="1.5"
          textAnchor="middle"
          x="300"
          y="551"
        >
          {draft.teamName.toLocaleUpperCase().slice(0, 18)}
        </text>
      </g>
    ),
    stats: (
      <g transform={`translate(${draft.statsX} ${draft.statsY})`}>
        <path d="M68 572H532" opacity="0.38" stroke={draft.secondaryColor} strokeWidth="1.5" />
        {statFields.map(([key, _label, code], index) => {
          const column = index % 3;
          const row = Math.floor(index / 3);
          const x = 72 + column * 162;
          const y = 598 + row * 70;
          const highlighted = highlightedStats.has(key);
          return (
            <g key={key}>
              <text
                fill={highlighted ? draft.secondaryColor : mutedCopy}
                fontFamily="JetBrains Mono, monospace"
                fontSize="10"
                fontWeight="700"
                letterSpacing="1.4"
                x={x}
                y={y}
              >
                {code}
              </text>
              <text
                fill={copyColor}
                fontFamily="Arial Narrow, Inter, sans-serif"
                fontSize="26"
                fontWeight={highlighted ? '800' : '600'}
                textAnchor="end"
                x={x + 120}
                y={y + 2}
              >
                {draft[key]}
              </text>
              <g visibility={draft.design.showStatBars ? 'visible' : 'hidden'}>
                <rect
                  fill={copyColor}
                  height="5"
                  opacity="0.13"
                  rx="2.5"
                  width="120"
                  x={x}
                  y={y + 15}
                />
                <rect
                  fill={highlighted ? draft.secondaryColor : copyColor}
                  height="5"
                  opacity={highlighted ? '0.95' : '0.48'}
                  rx="2.5"
                  width={(draft[key] / 100) * 120}
                  x={x}
                  y={y + 15}
                />
              </g>
            </g>
          );
        })}
        <CardEdition design={draft.design} />
        <text
          fill={mutedCopy}
          fontFamily="JetBrains Mono, monospace"
          fontSize="8"
          letterSpacing="2"
          textAnchor="middle"
          x="300"
          y="758"
        >
          FUTHUB · {draft.collectionName.toLocaleUpperCase().slice(0, 28)}
        </text>
      </g>
    ),
  };

  return (
    <div
      className={modelImage ? 'studio-card-render is-rendered' : 'studio-card-render'}
      data-render-state={
        renderError ? 'error' : currentRender ? (currentRender.model ? '3d' : 'svg') : 'pending'
      }
    >
      {svgRef && (
        <output className="studio-card-render-status" aria-live="polite">
          {renderError
            ? `Prévia vetorial · ${renderError}`
            : currentRender
              ? currentRender.model
                ? 'Modelo 3D atualizado'
                : 'Modo vetorial · 3D indisponível'
              : 'Atualizando modelo…'}
        </output>
      )}
      {modelImage && <img alt="" className="studio-card-model" src={modelImage} />}
      <svg
        aria-label={`Prévia do card de ${draft.name}`}
        className="studio-card-master"
        ref={svgRef}
        role="img"
        viewBox="0 0 600 800"
      >
        <defs>
          <linearGradient id={ids.body} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor={draft.primaryColor} />
            <stop offset="0.58" stopColor={deepPanel} />
            <stop offset="1" stopColor={darkCard ? '#02060c' : '#dbe3eb'} />
          </linearGradient>
          <radialGradient id={ids.ambient} cx="68%" cy="24%" r="74%">
            <stop offset="0" stopColor={draft.secondaryColor} stopOpacity="0.38" />
            <stop offset="0.5" stopColor={draft.primaryColor} stopOpacity="0.08" />
            <stop offset="1" stopColor={deepPanel} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ids.edge} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#fff4d6" />
            <stop offset="0.22" stopColor={frameMetal} />
            <stop offset="0.45" stopColor="#604521" />
            <stop offset="0.52" stopColor="#fff4d6" />
            <stop offset="0.76" stopColor={frameMetal} />
            <stop offset="1" stopColor="#604521" />
          </linearGradient>
          <linearGradient id={ids.fade} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={deepPanel} stopOpacity="0" />
            <stop offset="0.58" stopColor={deepPanel} stopOpacity="0.82" />
            <stop offset="1" stopColor={deepPanel} stopOpacity="0.98" />
          </linearGradient>
          <linearGradient id={ids.finish} x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor={draft.secondaryColor} stopOpacity="0" />
            <stop offset="0.46" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="0.66" stopColor={frameMetal} stopOpacity="0.1" />
            <stop offset="1" stopColor={draft.secondaryColor} stopOpacity="0.45" />
          </linearGradient>
          <filter height="160%" id={ids.frameGlow} width="160%" x="-30%" y="-30%">
            <feGaussianBlur stdDeviation={rarityTier >= 4 ? '12' : '8'} />
          </filter>
          <filter height="180%" id={ids.playerGlow} width="180%" x="-40%" y="-40%">
            <feGaussianBlur stdDeviation="32" />
          </filter>
          <filter id={ids.photoTone} colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values={String(draft.design.photoSaturation / 100)} />
            <feComponentTransfer>
              <feFuncR type="linear" slope={draft.design.photoBrightness / 100} />
              <feFuncG type="linear" slope={draft.design.photoBrightness / 100} />
              <feFuncB type="linear" slope={draft.design.photoBrightness / 100} />
            </feComponentTransfer>
          </filter>
          <clipPath id={ids.clip}>
            <path d={framePath} />
          </clipPath>
        </defs>

        {draft.layerOrder.map((layer) =>
          draft.layerVisibility[layer] ? (
            <g data-card-layer={layer} key={layer}>
              {layers[layer]}
            </g>
          ) : null,
        )}

        {showGuides && (
          <g data-export-ignore="true" fill="none" stroke="#70ddff" strokeDasharray="8 7">
            <path d={framePath} />
            <rect height="104" width="464" x="68" y="454" />
            <path d="M68 572H532M230 582V728M392 582V728" />
          </g>
        )}

        {onSelectLayer && (
          <g
            data-export-ignore="true"
            className={playground ? 'studio-hotspots is-playground' : 'studio-hotspots'}
          >
            <LayerHotspot
              active={activeLayer === 'background'}
              height={430}
              label="Background"
              layer="background"
              locked={draft.layerLocks.background}
              onSelect={onSelectLayer}
              width={540}
              x={30}
              y={24}
            />
            <LayerHotspot
              active={activeLayer === 'photo'}
              height={500}
              label="Player Photo"
              layer="photo"
              locked={draft.layerLocks.photo}
              onPointerDown={(event) => onDragStart?.('photo', event)}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onSelect={onSelectLayer}
              playground={playground}
              width={390}
              x={150 + draft.photoX}
              y={52 + draft.photoY}
            />
            <LayerHotspot
              active={activeLayer === 'rating'}
              height={210}
              label="Overall"
              layer="rating"
              locked={draft.layerLocks.rating}
              onPointerDown={(event) => onDragStart?.('rating', event)}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onSelect={onSelectLayer}
              playground={playground}
              width={108}
              x={66 + draft.ratingX}
              y={82 + draft.ratingY}
            />
            <LayerHotspot
              active={activeLayer === 'identity'}
              height={104}
              label="Name"
              layer="identity"
              locked={draft.layerLocks.identity}
              onPointerDown={(event) => onDragStart?.('identity', event)}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onSelect={onSelectLayer}
              playground={playground}
              width={464}
              x={68 + draft.identityX}
              y={454 + draft.identityY}
            />
            <LayerHotspot
              active={activeLayer === 'stats'}
              height={176}
              label="Stats"
              layer="stats"
              locked={draft.layerLocks.stats}
              onPointerDown={(event) => onDragStart?.('stats', event)}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onSelect={onSelectLayer}
              playground={playground}
              width={464}
              x={68 + draft.statsX}
              y={572 + draft.statsY}
            />
          </g>
        )}
      </svg>
    </div>
  );
}

function LayerHotspot({
  active,
  height,
  label,
  layer,
  locked,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onSelect,
  playground = false,
  width,
  x,
  y,
}: Readonly<{
  active: boolean;
  height: number;
  label: string;
  layer: LayerKey;
  locked: boolean;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onSelect: (layer: LayerKey) => void;
  playground?: boolean;
  width: number;
  x: number;
  y: number;
}>) {
  return (
    <g className="studio-layer-hotspot" data-active={active} data-draggable={playground && !locked}>
      <rect className="studio-layer-outline" height={height} rx="10" width={width} x={x} y={y} />
      <foreignObject height={height} width={width} x={x} y={y}>
        <button
          aria-label={`Editar ${label}`}
          className="studio-layer-hit-area"
          onClick={() => onSelect(layer)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          type="button"
        />
      </foreignObject>
      <g className="studio-layer-tag" transform={`translate(${x + 8} ${Math.max(34, y + 8)})`}>
        <rect height="24" rx="5" width={Math.max(76, label.length * 7 + 20)} />
        <text x="10" y="16">
          {locked && playground ? `${label} · lock` : label}
        </text>
      </g>
    </g>
  );
}

function draftFromCard(card: Card, collections: readonly Collection[]): StudioDraft {
  const collection = collections.find((entry) => entry.id === card.collection.id);
  return {
    ...emptyDraft,
    name: card.name,
    overall: card.overall,
    position: card.position,
    teamName: card.team.name,
    teamLogoUrl: card.team.imageUrl?.startsWith('https://assets.footylogos.com/')
      ? `/v1/admin/cards/team-logos/${encodeURIComponent(card.team.slug)}.svg`
      : (card.team.imageUrl ?? ''),
    collectionName: card.collection.name,
    collectionLogoUrl: collection?.imageUrl ?? card.collection.imageUrl ?? '',
    playerImageUrl: '',
    photoFormat: 'missing',
    primaryColor: collection?.primaryColor ?? emptyDraft.primaryColor,
    secondaryColor: collection?.secondaryColor ?? emptyDraft.secondaryColor,
    pace: card.pace,
    finishing: card.finishing,
    passing: card.passing,
    dribbling: card.dribbling,
    marking: card.marking,
    control: card.control,
  };
}

function readStoredSession(): StoredSession {
  const fallback: StoredSession = {
    draft: null,
    selectedCardId: '',
    snapshots: [],
    favoriteIds: [],
    recentIds: [],
  };
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(studioSessionKey) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return fallback;
    const value = parsed as Record<string, unknown>;
    const draft = parseStoredDraft(value.draft);
    const snapshots: Snapshot[] = [];
    if (Array.isArray(value.snapshots)) {
      for (const candidate of value.snapshots.slice(0, 8)) {
        if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate))
          continue;
        const snapshot = candidate as Record<string, unknown>;
        const snapshotDraft = parseStoredDraft(snapshot.draft);
        if (
          !snapshotDraft ||
          typeof snapshot.id !== 'string' ||
          typeof snapshot.name !== 'string' ||
          typeof snapshot.createdAt !== 'number'
        )
          continue;
        snapshots.push({
          id: snapshot.id,
          name: snapshot.name.slice(0, 32),
          createdAt: snapshot.createdAt,
          draft: snapshotDraft,
        });
      }
    }
    const favoriteIds = Array.isArray(value.favoriteIds)
      ? value.favoriteIds.filter((id): id is string => typeof id === 'string').slice(0, 100)
      : [];
    const recentIds = Array.isArray(value.recentIds)
      ? value.recentIds.filter((id): id is string => typeof id === 'string').slice(0, 6)
      : [];
    return {
      draft,
      selectedCardId: typeof value.selectedCardId === 'string' ? value.selectedCardId : '',
      snapshots,
      favoriteIds,
      recentIds,
    };
  } catch {
    return fallback;
  }
}

async function loadStudioCardArtwork(
  svg: SVGSVGElement,
  kind: StudioAssetKind,
): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  for (const ignored of clone.querySelectorAll('[data-export-ignore]')) ignored.remove();
  if (kind === 'simple-card') {
    for (const layer of clone.querySelectorAll(
      '[data-card-layer="effects"], [data-card-layer="badges"], [data-card-layer="stats"]',
    ))
      layer.remove();
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '600');
  clone.setAttribute('height', '800');
  await inlineImages(clone);
  const source = new XMLSerializer().serializeToString(clone);
  const svgUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
  try {
    return await loadImage(svgUrl);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

async function loadStudioCard(
  svg: SVGSVGElement,
  kind: StudioAssetKind,
  draft: StudioDraft,
): Promise<HTMLCanvasElement | HTMLImageElement> {
  const artwork = await loadStudioCardArtwork(svg, kind);
  try {
    return await cardModelImage(
      artwork,
      draft.design,
      kind !== 'simple-card' && draft.layerVisibility.badges,
    );
  } catch (error) {
    console.error('[StudioCardModel]', error);
    return artwork;
  }
}

function cardImageDataUrl(image: HTMLCanvasElement | HTMLImageElement): string {
  if (image instanceof HTMLCanvasElement) return image.toDataURL('image/png');
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponível para a prévia do card.');
  context.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

async function inlineImages(svg: SVGSVGElement): Promise<void> {
  const images = [...svg.querySelectorAll('image')];
  await Promise.all(
    images.map(async (image) => {
      const href = image.getAttribute('href');
      if (!href || href.startsWith('data:')) return;
      const response = await fetch(href);
      if (!response.ok) throw new Error(`Asset indisponível: ${response.status}`);
      image.setAttribute('href', await blobDataUrl(await response.blob()));
    }),
  );
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o asset.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Falha ao renderizar o SVG composto.'));
    image.src = source;
  });
}
async function loadRemoteImage(source: string): Promise<HTMLImageElement> {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Asset do jogador indisponível: ${response.status}`);
  return loadImage(await blobDataUrl(await response.blob()));
}

type StudioAssetComposition = Readonly<{
  cardImage: CanvasImageSource;
  draft: StudioDraft;
  height: number;
  includeShadow: boolean;
  kind: StudioAssetKind;
  playerImage: HTMLImageElement | null;
  transparentBackground: boolean;
  width: number;
}>;

function composeStudioAsset({
  cardImage,
  draft,
  height,
  includeShadow,
  kind,
  playerImage,
  transparentBackground,
  width,
}: StudioAssetComposition): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponível neste navegador.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const editorial = kind === 'social-image' || kind === 'share-image';
  if (editorial || !transparentBackground) paintStudioBackground(context, draft, width, height);

  if (kind === 'player-image') {
    if (!playerImage) throw new Error('Imagem do jogador indisponível para exportação.');
    drawContainedImage(
      context,
      playerImage,
      width * 0.06,
      height * 0.04,
      width * 0.88,
      height * 0.92,
      {
        shadow: includeShadow,
      },
    );
    return canvas;
  }

  if (kind === 'social-image') {
    const cardHeight = height * 0.9;
    drawCardImage(
      context,
      cardImage,
      width * 0.035,
      height * 0.05,
      cardHeight * 0.75,
      cardHeight,
      true,
    );
    drawEditorialCopy(context, draft, width * 0.42, height * 0.18, width * 0.53, height * 0.7);
    return canvas;
  }

  if (kind === 'share-image') {
    const cardHeight = height * 0.7;
    drawCardImage(
      context,
      cardImage,
      width * 0.025,
      height * 0.19,
      cardHeight * 0.75,
      cardHeight,
      true,
    );
    drawEditorialCopy(context, draft, width * 0.48, height * 0.2, width * 0.47, height * 0.68);
    return canvas;
  }

  if (kind === 'futgg-item') {
    const cardWidth = width * 0.92;
    drawCardImage(context, cardImage, 0, 0, cardWidth, height, includeShadow);
    drawFutggMarkers(context, draft, width, height);
    return canvas;
  }

  const inset = includeShadow ? width * 0.035 : 0;
  drawCardImage(
    context,
    cardImage,
    inset,
    (inset * 4) / 3,
    width - inset * 2,
    height - (inset * 8) / 3,
    includeShadow,
  );
  return canvas;
}

function paintStudioBackground(
  context: CanvasRenderingContext2D,
  draft: StudioDraft,
  width: number,
  height: number,
) {
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#070b12');
  background.addColorStop(0.52, draft.primaryColor);
  background.addColorStop(1, '#0c1119');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(
    width * 0.28,
    height * 0.22,
    0,
    width * 0.28,
    height * 0.22,
    width * 0.7,
  );
  glow.addColorStop(0, `${draft.secondaryColor}55`);
  glow.addColorStop(1, `${draft.secondaryColor}00`);
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.12;
  context.strokeStyle = draft.secondaryColor;
  context.lineWidth = Math.max(1, width / 1000);
  const spacing = Math.max(24, width / 20);
  for (let x = -height; x < width; x += spacing) {
    context.beginPath();
    context.moveTo(x, height);
    context.lineTo(x + height, 0);
    context.stroke();
  }
  context.restore();
}

function drawCardImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  shadow: boolean,
) {
  context.save();
  if (shadow) {
    context.shadowColor = 'rgba(0, 0, 0, 0.55)';
    context.shadowBlur = Math.max(10, width * 0.06);
    context.shadowOffsetY = Math.max(4, width * 0.025);
  }
  context.drawImage(image, x, y, width, height);
  context.restore();
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  options: Readonly<{ shadow: boolean }>,
) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const imageWidth = image.naturalWidth * ratio;
  const imageHeight = image.naturalHeight * ratio;
  context.save();
  if (options.shadow) {
    context.shadowColor = 'rgba(0, 0, 0, 0.48)';
    context.shadowBlur = Math.max(12, width * 0.045);
    context.shadowOffsetY = Math.max(6, height * 0.018);
  }
  context.drawImage(
    image,
    x + (width - imageWidth) / 2,
    y + height - imageHeight,
    imageWidth,
    imageHeight,
  );
  context.restore();
}

function drawFutggMarkers(
  context: CanvasRenderingContext2D,
  draft: StudioDraft,
  width: number,
  height: number,
) {
  const labels = ['RB', 'CB', 'CDM', 'LM'];
  const markerWidth = width * 0.105;
  const markerHeight = height * 0.052;
  const x = width - markerWidth - width * 0.018;
  labels.forEach((label, index) => {
    const y = height * 0.19 + index * markerHeight * 1.08;
    context.fillStyle = index % 2 ? draft.primaryColor : draft.secondaryColor;
    context.fillRect(x, y, markerWidth, markerHeight);
    context.fillStyle = index % 2 ? '#ffffff' : '#07121f';
    context.font = `700 ${Math.round(markerHeight * 0.42)}px "JetBrains Mono", monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, x + markerWidth / 2, y + markerHeight / 2);
  });
  context.fillStyle = draft.secondaryColor;
  context.fillRect(x, height * 0.53, markerWidth, markerHeight * 0.86);
  context.fillStyle = '#07121f';
  context.font = `700 ${Math.round(markerHeight * 0.28)}px "JetBrains Mono", monospace`;
  context.fillText('FUTHUB', x + markerWidth / 2, height * 0.53 + markerHeight * 0.43);
}

function drawEditorialCopy(
  context: CanvasRenderingContext2D,
  draft: StudioDraft,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const kickerSize = Math.max(10, height * 0.025);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = draft.secondaryColor;
  context.font = `700 ${kickerSize}px "JetBrains Mono", monospace`;
  context.fillText('FUTHUB / CARD REVEAL', x, y);

  const name = draft.name.toLocaleUpperCase();
  const targetNameSize = height * 0.13;
  context.font = `700 ${targetNameSize}px Inter, Arial, sans-serif`;
  const measuredName = context.measureText(name).width;
  const nameSize = Math.max(height * 0.065, targetNameSize * Math.min(1, width / measuredName));
  context.fillStyle = '#ffffff';
  context.font = `700 ${nameSize}px Inter, Arial, sans-serif`;
  context.fillText(name, x, y + height * 0.16);

  context.fillStyle = '#a9b8ca';
  context.font = `500 ${Math.max(11, height * 0.035)}px Inter, Arial, sans-serif`;
  context.fillText(
    `${draft.overall} OVR  ·  ${draft.position}  ·  ${draft.teamName}`,
    x,
    y + height * 0.24,
  );

  const gap = width * 0.045;
  const columnWidth = (width - gap) / 2;
  const rowHeight = height * 0.17;
  statFields.forEach(([key, _label, code], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const statX = x + column * (columnWidth + gap);
    const statY = y + height * 0.34 + row * rowHeight;
    context.fillStyle = 'rgba(255, 255, 255, 0.08)';
    context.fillRect(statX, statY, columnWidth, rowHeight * 0.72);
    context.fillStyle = '#a9b8ca';
    context.font = `600 ${Math.max(9, height * 0.025)}px "JetBrains Mono", monospace`;
    context.fillText(code, statX + columnWidth * 0.08, statY + rowHeight * 0.45);
    context.fillStyle = '#ffffff';
    context.font = `700 ${Math.max(14, height * 0.052)}px Inter, Arial, sans-serif`;
    context.textAlign = 'right';
    context.fillText(String(draft[key]), statX + columnWidth * 0.92, statY + rowHeight * 0.48);
    context.textAlign = 'left';
  });

  context.fillStyle = draft.secondaryColor;
  context.fillRect(x, y + height * 0.91, width * 0.28, Math.max(2, height * 0.008));
  context.fillStyle = '#8190a2';
  context.font = `500 ${Math.max(8, height * 0.022)}px "JetBrains Mono", monospace`;
  context.fillText(draft.collectionName.toLocaleUpperCase(), x, y + height * 0.98);
}

function canvasBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))),
      mime,
      quality,
    );
  });
}

function fileSlug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'card'
  );
}

function formatTime(value: number): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(value);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}
