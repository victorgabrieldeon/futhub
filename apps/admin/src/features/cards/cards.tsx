import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  type Card,
  type CardFilters,
  type CollectionFilters,
  type Catalog,
  type Collection,
  type CollectionArtworkSuggestion,
  type CollectionInput,
  type Page,
  type Preview,
  type Reference,
  type Team,
  type TeamFilters,
  type TeamInput,
  type TeamLogoSuggestion,
  createCard,
  createCollection,
  createTeam,
  downloadCardsTemplate,
  getCatalog,
  getTeamLogoDetails,
  importCards,
  listCards,
  listCollections,
  listTeamCards,
  listTeams,
  previewCards,
  removeCard as removeCardAction,
  removeCollection,
  removeTeam,
  searchCollectionArtworkSuggestions,
  searchTeamLogoSuggestions,
  updateCard,
  updateCollection,
  updateTeam,
  uploadCardImage,
} from './actions';

type FormValues = Record<string, string | boolean>;
type ActiveView = 'players' | 'collections' | 'teams' | 'import';
type DetailMode = 'view' | 'edit';
type ReferenceDetail = { kind: 'collection'; data: Collection } | { kind: 'team'; data: Team };
type NoticeTone = 'success' | 'info' | 'error';
type ImportPhase =
  | 'idle'
  | 'validating'
  | 'revealing'
  | 'success'
  | 'success-with-warnings'
  | 'validation-error'
  | 'unexpected-error'
  | 'publishing';
type ValidationStageStatus = 'active' | 'complete' | 'error' | 'waiting';
type AssetSuggestionsStatus = 'idle' | 'loading' | 'ready' | 'error';

const validationStages = [
  { id: 'structure', label: 'Estrutura da planilha', detail: 'Abas e formato do arquivo' },
  { id: 'columns', label: 'Colunas obrigatórias', detail: 'Cabeçalhos e campos exigidos' },
  { id: 'cards', label: 'Registros de jogadores', detail: 'Dados e atributos dos cards' },
  { id: 'references', label: 'Times e coleções', detail: 'Referências do catálogo' },
  { id: 'duplicates', label: 'Dados duplicados', detail: 'Identificadores e registros repetidos' },
] as const;

const views: ReadonlyArray<Readonly<{ id: ActiveView; label: string; description: string }>> = [
  { id: 'players', label: 'Jogadores', description: 'Cards e atributos' },
  { id: 'collections', label: 'Coleções', description: 'Edições do jogo' },
  { id: 'teams', label: 'Times', description: 'Clubes e escudos' },
  { id: 'import', label: 'Importação', description: 'Operação em lote' },
];

const viewHeadings: Record<
  ActiveView,
  Readonly<{ eyebrow: string; title: string; description: string }>
> = {
  players: {
    eyebrow: 'Acervo de atletas',
    title: 'Painel de jogadores',
    description: 'Gerencie os cards e as informações dos jogadores do FutHub.',
  },
  collections: {
    eyebrow: 'Edições do jogo',
    title: 'Galeria de coleções',
    description: 'Organize temporadas, eventos e regras visuais que agrupam o acervo.',
  },
  teams: {
    eyebrow: 'Diretório de clubes',
    title: 'Identidade dos times',
    description: 'Mantenha nomes, símbolos, escudos e cores disponíveis para os cards.',
  },
  import: {
    eyebrow: 'Operação assistida',
    title: 'Importar catálogo',
    description: 'Valide a planilha, confira o impacto e publique tudo em uma única operação.',
  },
};

const positions = ['GOL', 'LD', 'LE', 'ZAG', 'VOL', 'MA', 'MC', 'PD', 'PE', 'CA'];
const foundationStats = ['attack', 'defense', 'creation'] as const;
const technicalStats = ['passing', 'control', 'marking', 'pace', 'dribbling', 'finishing'] as const;
const stats = ['overall', ...foundationStats, ...technicalStats] as const;
const radarStats = ['attack', 'creation', 'pace', 'dribbling', 'finishing', 'defense'] as const;
type StatName = (typeof stats)[number];
const labels: Record<string, string> = {
  slug: 'Slug',
  name: 'Nome',
  collectionId: 'Coleção',
  teamId: 'Time',
  position: 'Posição',
  secondaryPositions: 'Posições secundárias',
  defense: 'Defesa',
  attack: 'Ataque',
  creation: 'Criação',
  overall: 'Overall',
  passing: 'Passe',
  control: 'Controle',
  marking: 'Marcação',
  pace: 'Velocidade',
  dribbling: 'Drible',
  finishing: 'Finalização',
};
const statCodes: Record<string, string> = {
  defense: 'DEF',
  attack: 'ATK',
  creation: 'CRI',
  overall: 'OVR',
  passing: 'PAS',
  control: 'CON',
  marking: 'MAR',
  pace: 'VEL',
  dribbling: 'DRI',
  finishing: 'FIN',
};
const statIconPaths: Record<StatName, readonly string[]> = {
  overall: [
    'm12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.77 6.5 20.6l1.05-6.12L3.1 10.15l6.15-.9L12 3Z',
  ],
  attack: ['M12 4a8 8 0 1 0 8 8', 'M12 8a4 4 0 1 0 4 4', 'm15 9 6-6', 'M17 3h4v4'],
  defense: ['M12 3 19 6v5c0 4.6-2.85 7.8-7 10-4.15-2.2-7-5.4-7-10V6l7-3Z', 'm9 12 2 2 4-4'],
  creation: [
    'M12 3v3',
    'M12 18v3',
    'M3 12h3',
    'M18 12h3',
    'm5.64-6.36 2.12 2.12',
    'm16.24 16.24 2.12 2.12',
    'm18.36 5.64-2.12 2.12',
    'm7.76 16.24-2.12 2.12',
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  ],
  passing: ['M4 8h14', 'm14 5 3 3-3 3', 'M20 16H6', 'm6 13-3 3 3 3'],
  control: [
    'M4 6h5',
    'M15 6h5',
    'M12 3v6',
    'M4 12h9',
    'M17 12h3',
    'M15 9v6',
    'M4 18h3',
    'M11 18h9',
    'M9 15v6',
  ],
  marking: ['M12 3a9 9 0 1 0 9 9', 'M12 7a5 5 0 1 0 5 5', 'M12 10a2 2 0 1 0 2 2'],
  pace: ['M4 7h10', 'M2 12h12', 'M5 17h9', 'm14 7 3 5-3 5', 'M17 12h4'],
  dribbling: [
    'M5 19c1-5 3-9 8-12 2-1 4-2 6-4',
    'M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    'M18 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  ],
  finishing: ['M4 19V6h16v13', 'M4 10h16', 'M12 10v9', 'M16 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
};

export function Cards({ variant = 'manager' }: Readonly<{ variant?: 'manager' | 'vault' }>) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeView, setActiveView] = useState<ActiveView>('players');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [page, setPage] = useState<Page<Card> | null>(null);
  const [collections, setCollections] = useState<Page<Collection> | null>(null);
  const [teams, setTeams] = useState<Page<Team> | null>(null);
  const [recentCards, setRecentCards] = useState<Card[]>([]);
  const [recentCollections, setRecentCollections] = useState<Collection[]>([]);
  const [recentTeams, setRecentTeams] = useState<Team[]>([]);
  const [catalogView, setCatalogView] = useState<Exclude<ActiveView, 'import' | 'players'> | null>(
    null,
  );
  const [selected, setSelected] = useState<Card | null>(null);
  const [vaultSelected, setVaultSelected] = useState<Card | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm());
  const [filters, setFilters] = useState<CardFilters>(() => {
    const state = location.state as { filters?: CardFilters } | null;
    return variant === 'vault' ? (state?.filters ?? { sort: 'recent' }) : { sort: 'recent' };
  });
  const [collectionFilters, setCollectionFilters] = useState<CollectionFilters>({});
  const [teamFilters, setTeamFilters] = useState<TeamFilters>({});
  const [cardPageNumber, setCardPageNumber] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<NoticeTone>('info');
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [revealedChecks, setRevealedChecks] = useState(0);
  const validationAbort = useRef<AbortController | null>(null);
  const validationSequence = useRef(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>('view');
  const [referenceDetail, setReferenceDetail] = useState<ReferenceDetail | null>(null);
  const [editingCollection, setEditingCollection] = useState<Collection | 'new' | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | 'new' | null>(null);
  const [collectionArtworkSuggestions, setCollectionArtworkSuggestions] = useState<
    CollectionArtworkSuggestion[]
  >([]);
  const [collectionArtworkSuggestionsStatus, setCollectionArtworkSuggestionsStatus] =
    useState<AssetSuggestionsStatus>('idle');
  const [collectionPreview, setCollectionPreview] = useState({
    bannerUrl: '',
    emoji: 'COL',
    imageUrl: '',
    name: '',
    overlayUrl: '',
    primaryColor: '#171717',
    secondaryColor: '#ffffff',
    slug: '',
  });
  const [teamPlayers, setTeamPlayers] = useState<Page<Card> | null>(null);
  const [teamPlayersLoading, setTeamPlayersLoading] = useState(false);
  const [teamLogoSuggestions, setTeamLogoSuggestions] = useState<TeamLogoSuggestion[]>([]);
  const [teamLogoSuggestionsStatus, setTeamLogoSuggestionsStatus] =
    useState<AssetSuggestionsStatus>('idle');
  const [teamLogoImporting, setTeamLogoImporting] = useState('');
  const [teamPreview, setTeamPreview] = useState({
    color: '#171717',
    colors: ['#171717'],
    emoji: 'FC',
    imageUrl: '',
    name: '',
    slug: '',
  });
  const editorDialog = useRef<HTMLDialogElement>(null);
  const collectionDialog = useRef<HTMLDialogElement>(null);
  const teamDialog = useRef<HTMLDialogElement>(null);
  const catalogDialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const referenceDetailDialog = useRef<HTMLDialogElement>(null);
  const playersRail = useRef<HTMLDivElement>(null);
  const collectionsRail = useRef<HTMLDivElement>(null);
  const teamsRail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    return () => validationAbort.current?.abort();
  }, []);

  useEffect(() => {
    if (importPhase !== 'revealing' || preview === null) return;
    const previewResult: Preview = preview;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let check = 0;
    let timer = window.setTimeout(revealNext, reducedMotion ? 0 : 140);

    function revealNext() {
      check += 1;
      setRevealedChecks(check);
      if (check < validationStages.length) {
        timer = window.setTimeout(revealNext, reducedMotion ? 0 : 220);
        return;
      }
      timer = window.setTimeout(
        () =>
          setImportPhase(
            previewResult.valid
              ? previewResult.errors.length
                ? 'success-with-warnings'
                : 'success'
              : 'validation-error',
          ),
        reducedMotion ? 0 : 260,
      );
    }

    return () => window.clearTimeout(timer);
  }, [importPhase, preview]);

  useEffect(() => {
    syncDialog(editorDialog.current, editorOpen);
  }, [editorOpen]);

  useEffect(() => {
    syncDialog(detailDialog.current, Boolean(detailCard));
  }, [detailCard]);

  useEffect(() => {
    syncDialog(referenceDetailDialog.current, Boolean(referenceDetail));
  }, [referenceDetail]);

  useEffect(() => {
    syncDialog(catalogDialog.current, Boolean(catalogView));
  }, [catalogView]);

  useEffect(() => {
    syncDialog(collectionDialog.current, Boolean(editingCollection));
  }, [editingCollection]);

  useEffect(() => {
    if (!editingCollection) return;
    setCollectionPreview(
      editingCollection === 'new'
        ? {
            bannerUrl: '',
            emoji: 'COL',
            imageUrl: '',
            name: '',
            overlayUrl: '',
            primaryColor: '#171717',
            secondaryColor: '#ffffff',
            slug: '',
          }
        : {
            bannerUrl: editingCollection.bannerUrl ?? '',
            emoji: editingCollection.emoji,
            imageUrl: editingCollection.imageUrl ?? '',
            name: editingCollection.name,
            overlayUrl: editingCollection.overlayUrl ?? '',
            primaryColor: editingCollection.primaryColor,
            secondaryColor: editingCollection.secondaryColor,
            slug: editingCollection.slug,
          },
    );
  }, [editingCollection]);

  useEffect(() => {
    const query = collectionPreview.name.trim();
    if (!editingCollection) {
      setCollectionArtworkSuggestions([]);
      setCollectionArtworkSuggestionsStatus('idle');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setCollectionArtworkSuggestionsStatus('loading');
      void searchCollectionArtworkSuggestions(query, controller.signal)
        .then((suggestions) => {
          if (controller.signal.aborted) return;
          setCollectionArtworkSuggestions(suggestions);
          setCollectionArtworkSuggestionsStatus('ready');
        })
        .catch(() => {
          if (!controller.signal.aborted) setCollectionArtworkSuggestionsStatus('error');
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [editingCollection, collectionPreview.name]);

  useEffect(() => {
    syncDialog(teamDialog.current, Boolean(editingTeam));
    if (!editingTeam || editingTeam === 'new') {
      setTeamPlayers(null);
      setTeamPlayersLoading(false);
      return;
    }
    let active = true;
    setTeamPlayers(null);
    setTeamPlayersLoading(true);
    void listTeamCards(editingTeam.id, 1, 24)
      .then((players) => {
        if (active) setTeamPlayers(players);
      })
      .catch((error) => {
        if (active) showNotice(errorMessage(error), 'error');
      })
      .finally(() => {
        if (active) setTeamPlayersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editingTeam]);
  useEffect(() => {
    if (!editingTeam) return;
    setTeamLogoImporting('');
    setTeamPreview(
      editingTeam === 'new'
        ? { color: '#171717', colors: ['#171717'], emoji: 'FC', imageUrl: '', name: '', slug: '' }
        : {
            color: editingTeam.color,
            colors: editingTeam.colors,
            emoji: editingTeam.emoji,
            imageUrl: editingTeam.imageUrl ?? '',
            name: editingTeam.name,
            slug: editingTeam.slug,
          },
    );
  }, [editingTeam]);

  useEffect(() => {
    const query = teamPreview.name.trim();
    if (!editingTeam || query.length < 2) {
      setTeamLogoSuggestions([]);
      setTeamLogoSuggestionsStatus('idle');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setTeamLogoSuggestionsStatus('loading');
      void searchTeamLogoSuggestions(query, controller.signal)
        .then((suggestions) => {
          if (controller.signal.aborted) return;
          setTeamLogoSuggestions(suggestions);
          setTeamLogoSuggestionsStatus('ready');
        })
        .catch(() => {
          if (!controller.signal.aborted) setTeamLogoSuggestionsStatus('error');
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [editingTeam, teamPreview.name]);

  function showNotice(message: string, tone: NoticeTone = 'success') {
    setNotice(message);
    setNoticeTone(tone);
  }

  async function load(filtersForRequest = filters, pageNumber = cardPageNumber) {
    setLoading(true);
    try {
      const [cards, latestCards, references, collectionPage, teamPage] = await Promise.all([
        listCards(pageNumber, 24, filtersForRequest),
        listCards(1, 12, { sort: 'recent' }),
        getCatalog(),
        listCollections(1, 12),
        listTeams(1, 12),
      ]);
      setPage(cards);
      setRecentCards(latestCards.items);
      setCardPageNumber(cards.page);
      setCatalog(references);
      setCollections(collectionPage);
      setRecentCollections(collectionPage.items);
      setTeams(teamPage);
      setRecentTeams(teamPage.items);
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadCollectionsPage(pageNumber: number, filtersForRequest = collectionFilters) {
    setCatalogLoading(true);
    try {
      setCollections(await listCollections(pageNumber, 12, filtersForRequest));
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setCatalogLoading(false);
    }
  }

  async function loadTeamsPage(pageNumber: number, filtersForRequest = teamFilters) {
    setCatalogLoading(true);
    try {
      setTeams(await listTeams(pageNumber, 12, filtersForRequest));
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setCatalogLoading(false);
    }
  }

  async function loadTeamPlayersPage(pageNumber: number) {
    if (!editingTeam || editingTeam === 'new') return;
    setTeamPlayersLoading(true);
    try {
      setTeamPlayers(await listTeamCards(editingTeam.id, pageNumber, 24));
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setTeamPlayersLoading(false);
    }
  }

  function inspectCard(card: Card) {
    catalogDialog.current?.close();
    setCatalogView(null);
    setDetailCard(card);
    setDetailMode('view');
    setNotice('');
  }

  function editCard(card: Card) {
    catalogDialog.current?.close();
    setCatalogView(null);
    setSelected(card);
    setForm(cardForm(card));
    setDetailCard(card);
    setDetailMode('edit');
    setNotice('');
  }

  function closeDetail() {
    setDetailCard(null);
    setDetailMode('view');
  }

  function cancelDetailEdit() {
    if (detailCard) setForm(cardForm(detailCard));
    setDetailMode('view');
  }

  function openCardStudio(card: Card) {
    detailDialog.current?.close();
    setDetailMode('view');
    setDetailCard(null);
    navigate('/app/studio', { state: { card } });
  }

  function openCardTeam(card: Card) {
    const nextFilters: TeamFilters = { query: card.team.name };
    detailDialog.current?.close();
    setDetailMode('view');
    setDetailCard(null);
    setActiveView('teams');
    setTeamFilters(nextFilters);
    setCatalogView('teams');
    void loadTeamsPage(1, nextFilters);
  }

  function openCardCollection(card: Card) {
    const nextFilters: CollectionFilters = { query: card.collection.name };
    detailDialog.current?.close();
    setDetailMode('view');
    setDetailCard(null);
    setActiveView('collections');
    setCollectionFilters(nextFilters);
    setCatalogView('collections');
    void loadCollectionsPage(1, nextFilters);
  }

  function inspectCollection(collection: Collection) {
    catalogDialog.current?.close();
    setCatalogView(null);
    setReferenceDetail({ kind: 'collection', data: collection });
  }

  function inspectTeam(team: Team) {
    catalogDialog.current?.close();
    setCatalogView(null);
    setReferenceDetail({ kind: 'team', data: team });
  }

  function closeReferenceDetail() {
    setReferenceDetail(null);
  }

  function openReferencePlayers() {
    if (!referenceDetail) return;
    const nextFilters: CardFilters =
      referenceDetail.kind === 'collection'
        ? { collectionId: referenceDetail.data.id, sort: 'recent' }
        : { teamId: referenceDetail.data.id, sort: 'recent' };
    referenceDetailDialog.current?.close();
    setReferenceDetail(null);
    navigate('/app/gerenciar/jogadores', { state: { filters: nextFilters } });
  }

  function editReference() {
    if (!referenceDetail) return;
    const detail = referenceDetail;
    referenceDetailDialog.current?.close();
    setReferenceDetail(null);
    if (detail.kind === 'collection') setEditingCollection(detail.data);
    else setEditingTeam(detail.data);
  }

  function startNewCard() {
    setSelected(null);
    setForm(emptyForm());
    setNotice('');
    setEditorOpen(true);
  }

  async function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected && cardCreationBlocked) {
      showNotice(referenceWarning || 'O catálogo ainda está carregando.', 'error');
      return;
    }
    const isExistingCard = selected !== null;
    setWorking(true);
    try {
      const body = requestBody(form);
      const result = selected
        ? await updateCard(selected.id, withoutSlug(body))
        : await createCard(body);
      if (!result.ok) {
        showNotice(result.error, 'error');
        return;
      }
      const card = result.card;
      setSelected(card);
      setForm(cardForm(card));
      if (isExistingCard) {
        setDetailCard(card);
        setDetailMode('view');
      } else {
        setEditorOpen(false);
        setDetailCard(card);
        setDetailMode('view');
      }
      await load();
      showNotice(isExistingCard ? 'Alterações salvas.' : 'Card criado.');
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setWorking(false);
    }
  }

  async function removeCard() {
    if (!selected || !window.confirm(`Remover ${selected.name}?`)) return;
    setWorking(true);
    try {
      await removeCardAction(selected.id);
      setSelected(null);
      setForm(emptyForm());
      setEditorOpen(false);
      closeDetail();
      await load();
      showNotice('Card removido.');
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setWorking(false);
    }
  }

  async function sendImage(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    if (!selected || !image) return;
    setWorking(true);
    try {
      const data = new FormData();
      data.append('file', image);
      const card = await uploadCardImage(selected.id, data);
      setSelected(card);
      setForm(cardForm(card));
      setDetailCard(card);
      await load();
      showNotice('Imagem atualizada.');
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setWorking(false);
    }
  }

  async function saveCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: CollectionInput = {
      slug: collectionPreview.slug,
      name: collectionPreview.name,
      emoji: collectionPreview.emoji,
      primaryColor: collectionPreview.primaryColor,
      secondaryColor: collectionPreview.secondaryColor,
      imageUrl: collectionPreview.imageUrl || null,
      overlayUrl: collectionPreview.overlayUrl || null,
      bannerUrl: collectionPreview.bannerUrl || null,
      contractsBlocked: data.has('contractsBlocked'),
    };
    setWorking(true);
    try {
      if (editingCollection === 'new') await createCollection(input);
      else if (editingCollection) await updateCollection(editingCollection.id, input);
      setEditingCollection(null);
      await load();
      if (catalogView === 'collections') await loadCollectionsPage(1);
      showNotice('Coleção salva.');
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setWorking(false);
    }
  }

  function applyCollectionArtwork(
    suggestion: CollectionArtworkSuggestion,
    includeIdentity: boolean,
  ) {
    setCollectionPreview((current) => ({
      ...current,
      ...(includeIdentity
        ? {
            emoji: suggestion.symbol || current.emoji,
            name: suggestion.name,
            primaryColor: suggestion.primaryColor,
            secondaryColor: suggestion.secondaryColor,
            slug: suggestion.slug,
          }
        : {}),
      bannerUrl: suggestion.bannerUrl,
      imageUrl: suggestion.imageUrl,
      overlayUrl: suggestion.overlayUrl,
    }));
    showNotice(
      includeIdentity
        ? `Identidade de ${suggestion.name} importada do FUT.GG.`
        : `Artes de ${suggestion.name} aplicadas.`,
    );
  }

  async function deleteCollection(collection: Collection) {
    if (!window.confirm(`Remover ${collection.name}?`)) return;
    setWorking(true);
    try {
      await removeCollection(collection.id);
      await load();
      if (catalogView === 'collections') await loadCollectionsPage(1);
      showNotice('Coleção removida.');
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setWorking(false);
    }
  }

  async function saveTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: TeamInput = {
      slug: teamPreview.slug,
      name: teamPreview.name,
      emoji: teamPreview.emoji,
      color: teamPreview.color,
      colors: teamPreview.colors,
      imageUrl: teamPreview.imageUrl || null,
    };
    setWorking(true);
    try {
      if (editingTeam === 'new') await createTeam(input);
      else if (editingTeam) await updateTeam(editingTeam.id, input);
      setEditingTeam(null);
      await load();
      if (catalogView === 'teams') await loadTeamsPage(1);
      showNotice('Time salvo.');
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setWorking(false);
    }
  }

  async function importTeamIdentity(suggestion: TeamLogoSuggestion) {
    setTeamLogoImporting(suggestion.slug);
    try {
      const details = await getTeamLogoDetails(suggestion.slug);
      setTeamPreview((current) => {
        const color = details.colors[0] ?? current.color;
        return {
          color,
          colors: details.colors.length ? details.colors : [color],
          emoji: details.symbol || current.emoji,
          imageUrl: details.imageUrl,
          name: details.name,
          slug: details.slug,
        };
      });
      showNotice(`Identidade de ${details.name} importada do FootyLogos.`);
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setTeamLogoImporting('');
    }
  }

  async function deleteTeam(team: Team) {
    if (!window.confirm(`Remover ${team.name}?`)) return;
    setWorking(true);
    try {
      await removeTeam(team.id);
      await load();
      if (catalogView === 'teams') await loadTeamsPage(1);
      showNotice('Time removido.');
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setWorking(false);
    }
  }

  async function downloadTemplate() {
    setWorking(true);
    try {
      const template = await downloadCardsTemplate();
      const bytes = Uint8Array.from(atob(template.contentBase64), (character) =>
        character.charCodeAt(0),
      );
      const url = URL.createObjectURL(new Blob([bytes]));
      const link = document.createElement('a');
      link.href = url;
      link.download = template.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showNotice(errorMessage(error), 'error');
    } finally {
      setWorking(false);
    }
  }

  async function inspectImport(fileToValidate = file) {
    if (!fileToValidate) return showNotice('Selecione um arquivo .xlsx.', 'error');
    validationAbort.current?.abort();
    const controller = new AbortController();
    const sequence = ++validationSequence.current;
    validationAbort.current = controller;
    setWorking(true);
    setPreview(null);
    setRevealedChecks(0);
    setImportPhase('validating');
    try {
      const result = await previewCards(workbookForm(fileToValidate), controller.signal);
      if (sequence !== validationSequence.current) return;
      setPreview(result);
      setImportPhase('revealing');
    } catch (error) {
      if (sequence !== validationSequence.current || controller.signal.aborted) return;
      setImportPhase('unexpected-error');
      showNotice(errorMessage(error), 'error');
    } finally {
      if (sequence === validationSequence.current) {
        validationAbort.current = null;
        setWorking(false);
      }
    }
  }

  function chooseImportFile(nextFile: File | null) {
    if (!nextFile) return;
    setFile(nextFile);
    void inspectImport(nextFile);
  }

  async function confirmImport() {
    if (!file || !preview?.valid) return;
    setWorking(true);
    setImportPhase('publishing');
    try {
      const result = await importCards(workbookForm(file));
      setPreview(null);
      setFile(null);
      setRevealedChecks(0);
      setImportPhase('idle');
      await load();
      showNotice(`${result.createCount} cards criados e ${result.updateCount} atualizados.`);
    } catch (error) {
      setImportPhase('success');
      showNotice(errorMessage(error), 'error');
    } finally {
      setWorking(false);
    }
  }

  function countForView(view: ActiveView): number | undefined {
    if (view === 'players') return page?.total;
    if (view === 'collections') return collections?.total;
    if (view === 'teams') return teams?.total;
    return undefined;
  }

  const heading = viewHeadings[activeView];
  const missingCardReferences = catalog
    ? [catalog.collections.length ? null : 'coleção', catalog.teams.length ? null : 'time'].filter(
        (reference): reference is string => reference !== null,
      )
    : [];
  const cardCreationBlocked = !selected && (!catalog || missingCardReferences.length > 0);
  const referenceWarning = missingCardReferences.length
    ? `Referências obrigatórias ausentes: ${missingCardReferences.join(', ')}.`
    : '';
  const playerCount = page?.total ?? 0;
  const playerCountLabel = `${playerCount} ${playerCount === 1 ? 'jogador' : 'jogadores'}`;
  const collectionCount = collections?.total ?? 0;
  const hasPlayerFilters = Boolean(
    filters.query || filters.teamId || filters.position || filters.sort !== 'recent',
  );
  const hasCollectionFilters = Boolean(
    collectionFilters.query || collectionFilters.contractsBlocked !== undefined,
  );
  const hasTeamFilters = Boolean(teamFilters.query || teamFilters.image);
  const playerFoundation = foundationStats.map((name) => ({
    name,
    value: Math.min(100, Math.max(1, Number(form[name]) || 0)),
  }));
  const playerFoundationAverage = Math.round(
    playerFoundation.reduce((total, stat) => total + stat.value, 0) / playerFoundation.length,
  );
  const playerOverall = Math.min(100, Math.max(1, Number(form.overall) || 0));

  return (
    <section
      className={`command-page cards-page${variant === 'vault' ? ' player-vault-page' : ''} ${activeView === 'collections' ? 'is-collections' : ''}`}
      aria-labelledby="card-ops-title"
    >
      <header className="command-header">
        <div>
          <p className="eyebrow">
            {variant === 'vault'
              ? 'Player Vault'
              : activeView === 'collections'
                ? 'Edições do jogo'
                : heading.eyebrow}
          </p>
          <h1 id="card-ops-title">
            {variant === 'vault' ? (
              'Banco de jogadores'
            ) : activeView === 'collections' ? (
              <>
                Coleções{' '}
                <span className="collection-count">{String(collectionCount).padStart(2, '0')}</span>
              </>
            ) : (
              heading.title
            )}
          </h1>
          <p>
            {variant === 'vault'
              ? 'Explore, selecione e gerencie seu elenco de cards.'
              : activeView === 'collections'
                ? 'Crie, organize e explore as edições do FutHub.'
                : heading.description}
          </p>
        </div>
        <div className="cards-header-side">
          {activeView !== 'collections' && (
            <p className="cards-record-count">
              {activeView === 'players'
                ? playerCountLabel
                : activeView === 'import'
                  ? 'Planilha XLSX'
                  : `${countForView(activeView) ?? 0} registros`}
            </p>
          )}
          <div className="cards-header-actions">
            {activeView === 'players' && (
              <button className="ops-button accent" onClick={startNewCard} type="button">
                Adicionar jogador
              </button>
            )}
            {activeView === 'collections' && (
              <button
                className="ops-button accent"
                onClick={() => setEditingCollection('new')}
                type="button"
              >
                + Nova coleção
              </button>
            )}
            {activeView === 'teams' && (
              <button
                className="ops-button accent"
                onClick={() => setEditingTeam('new')}
                type="button"
              >
                Novo time
              </button>
            )}
            {activeView === 'import' && (
              <button
                className="ops-button secondary"
                disabled={working}
                onClick={downloadTemplate}
                type="button"
              >
                Baixar modelo
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="cards-panel">
        {variant === 'vault' ? (
          <PlayerVault
            catalog={catalog}
            filters={filters}
            hasFilters={hasPlayerFilters}
            loading={loading}
            onAdd={startNewCard}
            onClearFilters={() => {
              const nextFilters: CardFilters = { sort: 'recent' };
              setFilters(nextFilters);
              setVaultSelected(null);
              void load(nextFilters, 1);
            }}
            onEdit={editCard}
            onOpenStudio={openCardStudio}
            onPageChange={(pageNumber) => void load(filters, pageNumber)}
            onQueryChange={(query) => setFilters((current) => ({ ...current, query }))}
            onSearch={() => {
              setVaultSelected(null);
              void load(filters, 1);
            }}
            onSelect={setVaultSelected}
            onFiltersChange={(nextFilters) => {
              setFilters(nextFilters);
              setVaultSelected(null);
              void load(nextFilters, 1);
            }}
            page={page}
            recentCards={recentCards}
            selectedCard={vaultSelected}
          />
        ) : (
          <>
            <div aria-label="Gerenciamento de cards" className="command-tabs" role="tablist">
              {views.map((view, index) => (
                <button
                  aria-controls={`${view.id}-view`}
                  aria-selected={activeView === view.id}
                  className="command-tab"
                  id={`${view.id}-tab`}
                  key={view.id}
                  onClick={() => setActiveView(view.id)}
                  onKeyDown={(event) => {
                    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key))
                      return;
                    const direction =
                      event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
                    const next = views[(index + direction + views.length) % views.length];
                    setActiveView(next.id);
                    requestAnimationFrame(() => document.getElementById(`${next.id}-tab`)?.focus());
                  }}
                  role="tab"
                  tabIndex={activeView === view.id ? 0 : -1}
                  type="button"
                >
                  {view.label}
                </button>
              ))}
            </div>

            {notice && (
              <div
                aria-live={noticeTone === 'error' ? 'assertive' : 'polite'}
                className={`ops-toast ${noticeTone}`}
                role={noticeTone === 'error' ? 'alert' : 'status'}
              >
                <span />
                <p>{notice}</p>
                <button aria-label="Fechar aviso" onClick={() => setNotice('')} type="button">
                  ×
                </button>
              </div>
            )}

            <section
              aria-labelledby="players-tab"
              className="player-board"
              hidden={activeView !== 'players'}
              id="players-view"
              role="tabpanel"
            >
              {recentCards[0] ? (
                <>
                  <PlayerSpotlight
                    card={recentCards[0]}
                    onEdit={editCard}
                    onExplore={inspectCard}
                    onOpenCatalog={() => navigate('/app/gerenciar/jogadores')}
                  />
                  {recentCards.length > 1 ? (
                    <CatalogRail
                      eyebrow="Continue explorando"
                      countLabel={`${recentCards.length - 1} restantes`}
                      description="Outros jogadores adicionados ao acervo."
                      id="players-recent"
                      onOpen={() => navigate('/app/gerenciar/jogadores')}
                      title="Mais jogadores"
                      trackRef={playersRail}
                      variant="players"
                    >
                      {recentCards.slice(1).map((card) => (
                        <PlayerCardTile
                          card={card}
                          key={card.id}
                          onEdit={editCard}
                          onInspect={inspectCard}
                        />
                      ))}
                    </CatalogRail>
                  ) : (
                    <GalleryStart
                      action="Adicionar jogador"
                      description="Adicione jogadores para formar o acervo do FutHub."
                      onAction={startNewCard}
                      title="Seu elenco está começando."
                    />
                  )}
                </>
              ) : (
                <GalleryStart
                  action="Adicionar jogador"
                  description="Crie o primeiro card para começar o acervo."
                  onAction={startNewCard}
                  title="Nenhum jogador cadastrado."
                />
              )}
            </section>

            <section
              aria-labelledby="collections-tab"
              className="reference-gallery collection-gallery"
              hidden={activeView !== 'collections'}
              id="collections-view"
              role="tabpanel"
            >
              {recentCollections[0] ? (
                <>
                  <CollectionSpotlight
                    collection={recentCollections[0]}
                    onExplore={inspectCollection}
                    onOpenCatalog={() => setCatalogView('collections')}
                  />
                  {recentCollections.length > 1 ? (
                    <CatalogRail
                      eyebrow="Continue explorando"
                      countLabel={`${recentCollections.length - 1} restantes`}
                      description="Outras edições recentes do acervo."
                      id="collections-recent"
                      onOpen={() => setCatalogView('collections')}
                      title="Mais coleções"
                      trackRef={collectionsRail}
                      variant="references"
                    >
                      {recentCollections.slice(1).map((collection, index) => (
                        <CollectionCardTile
                          collection={collection}
                          index={index + 1}
                          key={collection.id}
                          onInspect={inspectCollection}
                          onRemove={deleteCollection}
                          working={working}
                        />
                      ))}
                    </CatalogRail>
                  ) : (
                    <GalleryStart
                      action="Nova coleção"
                      description="Crie novas edições para construir o universo do FutHub."
                      onAction={() => setEditingCollection('new')}
                      title="Sua galeria está começando."
                    />
                  )}
                </>
              ) : (
                <GalleryStart
                  action="Nova coleção"
                  description="Organize temporadas e eventos com uma identidade visual própria."
                  onAction={() => setEditingCollection('new')}
                  title="Crie a primeira coleção."
                />
              )}
            </section>

            <section
              aria-labelledby="teams-tab"
              className="reference-gallery team-gallery"
              hidden={activeView !== 'teams'}
              id="teams-view"
              role="tabpanel"
            >
              {recentTeams[0] ? (
                <>
                  <TeamSpotlight
                    onExplore={inspectTeam}
                    onOpenCatalog={() => setCatalogView('teams')}
                    team={recentTeams[0]}
                  />
                  {recentTeams.length > 1 ? (
                    <CatalogRail
                      eyebrow="Continue explorando"
                      countLabel={`${recentTeams.length - 1} restantes`}
                      description="Outros clubes disponíveis para os cards."
                      id="teams-recent"
                      onOpen={() => setCatalogView('teams')}
                      title="Mais times"
                      trackRef={teamsRail}
                      variant="references"
                    >
                      {recentTeams.slice(1).map((team, index) => (
                        <TeamCardTile
                          index={index + 1}
                          key={team.id}
                          onInspect={inspectTeam}
                          onRemove={deleteTeam}
                          team={team}
                          working={working}
                        />
                      ))}
                    </CatalogRail>
                  ) : (
                    <GalleryStart
                      action="Novo time"
                      description="Cadastre clubes para vincular identidade aos jogadores."
                      onAction={() => setEditingTeam('new')}
                      title="Seu diretório está começando."
                    />
                  )}
                </>
              ) : (
                <GalleryStart
                  action="Novo time"
                  description="Cadastre o primeiro clube para vinculá-lo aos jogadores."
                  onAction={() => setEditingTeam('new')}
                  title="Nenhum time cadastrado."
                />
              )}
            </section>

            <section
              aria-labelledby="import-tab"
              className="import-deck"
              hidden={activeView !== 'import'}
              id="import-view"
              role="tabpanel"
            >
              <aside className="import-route">
                <p className="eyebrow">Rota de publicação</p>
                <ol>
                  <li className="complete">
                    <b>Modelo</b>
                    <span>Baixe a estrutura oficial.</span>
                  </li>
                  <li className={file ? 'complete' : 'active'}>
                    <b>Arquivo</b>
                    <span>Selecione a planilha preenchida.</span>
                  </li>
                  <li
                    className={
                      importPhase === 'validation-error' || importPhase === 'unexpected-error'
                        ? 'error'
                        : preview
                          ? 'complete'
                          : file
                            ? 'active'
                            : ''
                    }
                  >
                    <b>Validação</b>
                    <span>O sistema analisa a planilha antes da publicação.</span>
                  </li>
                  <li className={preview?.valid && importPhase !== 'publishing' ? 'active' : ''}>
                    <b>Publicação</b>
                    <span>Confirme a operação no catálogo.</span>
                  </li>
                </ol>
              </aside>
              <CatalogImportWorkspace
                file={file}
                onFileChange={chooseImportFile}
                onPublish={() => void confirmImport()}
                onRetry={() => void inspectImport()}
                phase={importPhase}
                preview={preview}
                revealedChecks={revealedChecks}
              />
            </section>
          </>
        )}

        <dialog
          aria-labelledby="catalog-browser-title"
          className="catalog-browser-dialog"
          id="catalog-browser-dialog"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCatalogView(null);
          }}
          onClose={() => setCatalogView(null)}
          ref={catalogDialog}
        >
          <div className="catalog-browser-shell">
            <header className="catalog-browser-header">
              <div>
                <p className="eyebrow">Catálogo completo</p>
                <h2 id="catalog-browser-title">
                  {catalogView === 'collections' ? 'Todas as coleções' : 'Todos os times'}
                </h2>
                <p>Busque, filtre e gerencie registros sem alongar a tela principal.</p>
              </div>
              <div className="catalog-browser-header-actions">
                <span className="catalog-browser-count">
                  {catalogView === 'collections'
                    ? `${collections?.total ?? 0} ${collections?.total === 1 ? 'coleção' : 'coleções'}`
                    : `${teams?.total ?? 0} ${teams?.total === 1 ? 'time' : 'times'}`}
                </span>
                {catalogView === 'collections' && (
                  <button
                    className="ops-button accent"
                    onClick={() => setEditingCollection('new')}
                    type="button"
                  >
                    Nova coleção
                  </button>
                )}
                {catalogView === 'teams' && (
                  <button
                    className="ops-button accent"
                    onClick={() => setEditingTeam('new')}
                    type="button"
                  >
                    Novo time
                  </button>
                )}
                <button
                  aria-label="Fechar catálogo"
                  className="catalog-browser-close"
                  onClick={() => setCatalogView(null)}
                  type="button"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="catalog-browser-toolbar">
              {catalogView === 'collections' && (
                <form
                  className="catalog-filter-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadCollectionsPage(1, collectionFilters);
                  }}
                >
                  <label className="catalog-filter-search">
                    <span>Buscar</span>
                    <input
                      autoComplete="off"
                      autoFocus
                      onChange={(event) =>
                        setCollectionFilters({ ...collectionFilters, query: event.target.value })
                      }
                      placeholder="Nome ou slug da coleção"
                      type="search"
                      value={collectionFilters.query ?? ''}
                    />
                  </label>
                  <label>
                    <span>Contratos</span>
                    <select
                      onChange={(event) => {
                        const contractsBlocked =
                          event.target.value === '' ? undefined : event.target.value === 'true';
                        const nextFilters = { ...collectionFilters, contractsBlocked };
                        setCollectionFilters(nextFilters);
                        void loadCollectionsPage(1, nextFilters);
                      }}
                      value={
                        collectionFilters.contractsBlocked === undefined
                          ? ''
                          : String(collectionFilters.contractsBlocked)
                      }
                    >
                      <option value="">Todos</option>
                      <option value="false">Liberados</option>
                      <option value="true">Bloqueados</option>
                    </select>
                  </label>
                  <button className="ops-button secondary" type="submit">
                    Buscar
                  </button>
                  {hasCollectionFilters && (
                    <button
                      className="catalog-filter-clear"
                      onClick={() => {
                        setCollectionFilters({});
                        void loadCollectionsPage(1, {});
                      }}
                      type="button"
                    >
                      Limpar
                    </button>
                  )}
                </form>
              )}

              {catalogView === 'teams' && (
                <form
                  className="catalog-filter-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadTeamsPage(1, teamFilters);
                  }}
                >
                  <label className="catalog-filter-search">
                    <span>Buscar</span>
                    <input
                      autoComplete="off"
                      autoFocus
                      onChange={(event) =>
                        setTeamFilters({ ...teamFilters, query: event.target.value })
                      }
                      placeholder="Nome ou slug do time"
                      type="search"
                      value={teamFilters.query ?? ''}
                    />
                  </label>
                  <label>
                    <span>Escudo</span>
                    <select
                      onChange={(event) => {
                        const image = event.target.value as TeamFilters['image'] | '';
                        const nextFilters = { ...teamFilters, image: image || undefined };
                        setTeamFilters(nextFilters);
                        void loadTeamsPage(1, nextFilters);
                      }}
                      value={teamFilters.image ?? ''}
                    >
                      <option value="">Todos</option>
                      <option value="custom">Configurado</option>
                      <option value="default">Sem escudo</option>
                    </select>
                  </label>
                  <button className="ops-button secondary" type="submit">
                    Buscar
                  </button>
                  {hasTeamFilters && (
                    <button
                      className="catalog-filter-clear"
                      onClick={() => {
                        setTeamFilters({});
                        void loadTeamsPage(1, {});
                      }}
                      type="button"
                    >
                      Limpar
                    </button>
                  )}
                </form>
              )}
            </div>

            <div
              aria-busy={loading || catalogLoading}
              className={`catalog-browser-content ${catalogView ?? ''}`}
            >
              {catalogView === 'collections' &&
                (loading || catalogLoading ? (
                  <div className="catalog-browser-loading">Carregando coleções…</div>
                ) : collections?.items.length ? (
                  <div className="collection-grid">
                    {collections.items.map((collection, index) => (
                      <CollectionCardTile
                        collection={collection}
                        index={index}
                        key={collection.id}
                        onInspect={inspectCollection}
                        onRemove={deleteCollection}
                        working={working}
                      />
                    ))}
                  </div>
                ) : (
                  <BoardEmpty
                    action={hasCollectionFilters ? 'Limpar filtros' : 'Criar coleção'}
                    description={
                      hasCollectionFilters
                        ? 'Nenhuma coleção corresponde aos filtros atuais.'
                        : 'Crie a primeira edição visual do catálogo.'
                    }
                    onAction={() => {
                      if (!hasCollectionFilters) return setEditingCollection('new');
                      setCollectionFilters({});
                      void loadCollectionsPage(1, {});
                    }}
                    title={
                      hasCollectionFilters
                        ? 'Nenhuma coleção encontrada'
                        : 'Nenhuma coleção cadastrada'
                    }
                  />
                ))}

              {catalogView === 'teams' &&
                (loading || catalogLoading ? (
                  <div className="catalog-browser-loading">Carregando times…</div>
                ) : teams?.items.length ? (
                  <div className="collection-grid">
                    {teams.items.map((team, index) => (
                      <TeamCardTile
                        index={index}
                        key={team.id}
                        onInspect={inspectTeam}
                        onRemove={deleteTeam}
                        team={team}
                        working={working}
                      />
                    ))}
                  </div>
                ) : (
                  <BoardEmpty
                    action={hasTeamFilters ? 'Limpar filtros' : 'Criar time'}
                    description={
                      hasTeamFilters
                        ? 'Nenhum time corresponde aos filtros atuais.'
                        : 'Cadastre o primeiro clube para vinculá-lo aos jogadores.'
                    }
                    onAction={() => {
                      if (!hasTeamFilters) return setEditingTeam('new');
                      setTeamFilters({});
                      void loadTeamsPage(1, {});
                    }}
                    title={hasTeamFilters ? 'Nenhum time encontrado' : 'Nenhum time cadastrado'}
                  />
                ))}
            </div>

            <footer className="catalog-browser-footer">
              {catalogView === 'collections' && (
                <Pagination page={collections} onPageChange={loadCollectionsPage} />
              )}
              {catalogView === 'teams' && <Pagination page={teams} onPageChange={loadTeamsPage} />}
            </footer>
          </div>
        </dialog>

        <PlayerDetailDialog
          card={detailCard}
          catalog={catalog}
          dialogRef={detailDialog}
          form={form}
          mode={detailMode}
          onCancelEdit={cancelDetailEdit}
          onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
          onClose={closeDetail}
          onEdit={editCard}
          onImageChange={sendImage}
          onOpenCollection={openCardCollection}
          onOpenStudio={openCardStudio}
          onOpenTeam={openCardTeam}
          onRemove={() => void removeCard()}
          onSave={saveCard}
          working={working}
        />

        <ReferenceDetailDialog
          detail={referenceDetail}
          dialogRef={referenceDetailDialog}
          onClose={closeReferenceDetail}
          onEdit={editReference}
          onOpenPlayers={openReferencePlayers}
        />

        <dialog
          aria-labelledby="player-editor-title"
          className="player-drawer"
          onClick={(event) => {
            if (event.target === event.currentTarget) setEditorOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setEditorOpen(false);
          }}
          onClose={() => setEditorOpen(false)}
          ref={editorDialog}
        >
          <form className="player-drawer-card" onSubmit={saveCard}>
            <header>
              <div>
                <p className="eyebrow">{selected ? 'Editar jogador' : 'Novo jogador'}</p>
                <h2 id="player-editor-title">{selected?.name ?? 'Cadastrar card'}</h2>
                <p>{selected ? selected.slug : 'Preencha identidade, vínculos e desempenho.'}</p>
              </div>
              <button aria-label="Fechar editor" onClick={() => setEditorOpen(false)} type="button">
                ×
              </button>
            </header>
            <div className="player-drawer-scroll">
              {selected && (
                <section className="drawer-player-summary">
                  <img alt={selected.name} height={120} src={selected.imageUrl} width={90} />
                  <div>
                    <small>{selected.collection.name}</small>
                    <strong>{selected.name}</strong>
                    <span>
                      {selected.team.name} · {selected.position}
                    </span>
                    <label className="drawer-file-button">
                      Trocar imagem
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        disabled={working}
                        onChange={sendImage}
                        type="file"
                      />
                    </label>
                  </div>
                  <b>
                    <small>OVR</small>
                    {selected.overall}
                  </b>
                </section>
              )}
              {!selected && referenceWarning && (
                <div className="drawer-reference-warning" role="alert">
                  <strong>Catálogo incompleto</strong>
                  <span>
                    {referenceWarning} Adicione essas referências antes de criar jogadores.
                  </span>
                </div>
              )}
              <fieldset>
                <legend>
                  <span>Identidade</span>
                  <small>Informações principais do card.</small>
                </legend>
                <div className="drawer-form-grid two-columns">
                  {field('slug', '', 'text', Boolean(selected))}
                  {field('name')}
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  <span>Vínculos</span>
                  <small>Referências usadas no catálogo.</small>
                </legend>
                <div className="drawer-form-grid two-columns">
                  {selectField('collectionId', catalog?.collections)}
                  {selectField('teamId', catalog?.teams)}
                  {positionField()}
                  {secondaryPositionsField()}
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  <span>Desempenho</span>
                  <small>Atributos entre 1 e 100.</small>
                </legend>
                <div className="drawer-performance">
                  <section aria-label="Overall geral" className="drawer-stat-overview">
                    {statField('overall', 'drawer-stat-overall')}
                  </section>
                  <section className="drawer-stat-group">
                    <header>
                      <strong>Fundamentos</strong>
                      <small>Ataque, defesa e criação.</small>
                    </header>
                    <div className="drawer-stat-grid foundation">
                      {foundationStats.map((name) => statField(name))}
                    </div>
                  </section>
                  <section className="drawer-stat-group">
                    <header>
                      <strong>Atributos técnicos</strong>
                      <small>Capacidades específicas do jogador.</small>
                    </header>
                    <div className="drawer-stat-grid technical">
                      {technicalStats.map((name) => statField(name))}
                    </div>
                  </section>
                  <section
                    aria-labelledby="player-profile-title"
                    className="drawer-performance-preview"
                  >
                    <header>
                      <div>
                        <p className="eyebrow">Leitura ao vivo</p>
                        <h3 id="player-profile-title">Perfil de desempenho</h3>
                      </div>
                      <output>
                        <strong>{playerOverall}</strong>
                        <span>OVR</span>
                      </output>
                    </header>
                    <div className="drawer-profile-bars">
                      {playerFoundation.map((stat) => (
                        <div key={stat.name}>
                          <div>
                            <span>{labels[stat.name]}</span>
                            <strong>{stat.value}</strong>
                          </div>
                          <div
                            aria-label={`${labels[stat.name]}: ${stat.value}`}
                            aria-valuemax={100}
                            aria-valuemin={1}
                            aria-valuenow={stat.value}
                            className="drawer-profile-track"
                            role="progressbar"
                          >
                            <i style={{ width: `${stat.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p>Média dos fundamentos: {playerFoundationAverage}.</p>
                  </section>
                </div>
              </fieldset>
              <label className="drawer-toggle">
                <input
                  checked={Boolean(form.contractsBlocked)}
                  name="contractsBlocked"
                  onChange={(event) => setForm({ ...form, contractsBlocked: event.target.checked })}
                  type="checkbox"
                />
                <span>
                  <strong>Bloquear contratos</strong>
                  <small>Impede aplicação de contratos neste card.</small>
                </span>
              </label>
            </div>
            <footer>
              {selected ? (
                <button
                  className="ops-button danger"
                  disabled={working}
                  onClick={removeCard}
                  type="button"
                >
                  Remover
                </button>
              ) : (
                <span />
              )}
              <div>
                <button
                  className="ops-button secondary"
                  onClick={() => setEditorOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="ops-button accent"
                  disabled={working || cardCreationBlocked}
                  type="submit"
                >
                  {working ? 'Salvando…' : selected ? 'Salvar alterações' : 'Criar jogador'}
                </button>
              </div>
            </footer>
          </form>
        </dialog>

        {editingCollection && (
          <dialog
            aria-labelledby="collection-dialog-title"
            className="ops-dialog"
            onClick={(event) => {
              if (event.target === event.currentTarget) setEditingCollection(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setEditingCollection(null);
            }}
            onClose={() => setEditingCollection(null)}
            ref={collectionDialog}
          >
            <form className="ops-dialog-card" onSubmit={saveCollection}>
              <header>
                <div>
                  <p className="eyebrow">Coleção</p>
                  <h2 id="collection-dialog-title">
                    {editingCollection === 'new' ? 'Nova coleção' : 'Editar coleção'}
                  </h2>
                  <p>Defina identidade visual e regras de contratos.</p>
                </div>
                <button
                  aria-label="Fechar"
                  onClick={() => setEditingCollection(null)}
                  type="button"
                >
                  ×
                </button>
              </header>
              <div className="ops-dialog-body drawer-form-grid two-columns">
                <label>
                  Nome
                  <input
                    name="name"
                    onChange={(event) =>
                      setCollectionPreview((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                    value={collectionPreview.name}
                  />
                </label>
                <label>
                  Slug
                  <input
                    name="slug"
                    onChange={(event) =>
                      setCollectionPreview((current) => ({ ...current, slug: event.target.value }))
                    }
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    required
                    title="Use letras minúsculas, números e hífens."
                    value={collectionPreview.slug}
                  />
                </label>
                <label>
                  Símbolo
                  <input
                    name="emoji"
                    onChange={(event) =>
                      setCollectionPreview((current) => ({ ...current, emoji: event.target.value }))
                    }
                    required
                    value={collectionPreview.emoji}
                  />
                </label>
                <label>
                  Cor primária
                  <input
                    name="primaryColor"
                    onChange={(event) =>
                      setCollectionPreview((current) => ({
                        ...current,
                        primaryColor: event.target.value,
                      }))
                    }
                    required
                    type="color"
                    value={collectionPreview.primaryColor}
                  />
                </label>
                <label>
                  Cor secundária
                  <input
                    name="secondaryColor"
                    onChange={(event) =>
                      setCollectionPreview((current) => ({
                        ...current,
                        secondaryColor: event.target.value,
                      }))
                    }
                    required
                    type="color"
                    value={collectionPreview.secondaryColor}
                  />
                </label>
                <label className="full-width">
                  URL da imagem
                  <input
                    name="imageUrl"
                    onChange={(event) =>
                      setCollectionPreview((current) => ({
                        ...current,
                        imageUrl: event.target.value,
                      }))
                    }
                    type="url"
                    value={collectionPreview.imageUrl}
                  />
                </label>
                <label className="full-width">
                  URL do overlay
                  <input
                    name="overlayUrl"
                    onChange={(event) =>
                      setCollectionPreview((current) => ({
                        ...current,
                        overlayUrl: event.target.value,
                      }))
                    }
                    type="url"
                    value={collectionPreview.overlayUrl}
                  />
                </label>
                <label className="full-width">
                  URL do banner
                  <input
                    name="bannerUrl"
                    onChange={(event) =>
                      setCollectionPreview((current) => ({
                        ...current,
                        bannerUrl: event.target.value,
                      }))
                    }
                    type="url"
                    value={collectionPreview.bannerUrl}
                  />
                </label>
                <section
                  aria-busy={collectionArtworkSuggestionsStatus === 'loading'}
                  aria-live="polite"
                  aria-labelledby="collection-artwork-suggestions-title"
                  className="team-logo-suggestions full-width"
                >
                  <header>
                    <div>
                      <p className="eyebrow" id="collection-artwork-suggestions-title">
                        Importar do FUT.GG
                      </p>
                      <small>
                        Preencha identidade, paleta, imagem, overlay e banner em um clique.
                      </small>
                    </div>
                    <a href="https://www.fut.gg/rarities/" rel="noreferrer" target="_blank">
                      Abrir catálogo
                    </a>
                  </header>
                  {collectionArtworkSuggestionsStatus === 'loading' ? (
                    <p className="team-logo-suggestions-empty">Buscando artes…</p>
                  ) : collectionArtworkSuggestions.length ? (
                    <ul>
                      {collectionArtworkSuggestions.map((suggestion) => (
                        <li key={suggestion.sourceUrl}>
                          <div className="team-logo-suggestion-copy">
                            <img alt="" src={suggestion.overlayUrl} />
                            <span>
                              <strong>{suggestion.name}</strong>
                              <small>{suggestion.description}</small>
                            </span>
                          </div>
                          <div className="team-logo-suggestion-actions">
                            <button
                              onClick={() => applyCollectionArtwork(suggestion, false)}
                              type="button"
                            >
                              Só artes
                            </button>
                            <button
                              className="is-primary"
                              onClick={() => applyCollectionArtwork(suggestion, true)}
                              type="button"
                            >
                              Importar tudo
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="team-logo-suggestions-empty">
                      {collectionArtworkSuggestionsStatus === 'error'
                        ? 'Não foi possível carregar sugestões agora.'
                        : 'Nenhuma arte disponível no catálogo.'}
                    </p>
                  )}
                </section>
                <label className="drawer-toggle full-width">
                  <input
                    defaultChecked={
                      editingCollection !== 'new' && editingCollection.contractsBlocked
                    }
                    name="contractsBlocked"
                    type="checkbox"
                  />
                  <span>
                    <strong>Bloquear contratos</strong>
                    <small>Impede contratos nos cards desta coleção.</small>
                  </span>
                </label>
              </div>
              <footer>
                <button
                  className="ops-button secondary"
                  onClick={() => setEditingCollection(null)}
                  type="button"
                >
                  Cancelar
                </button>
                <button className="ops-button accent" disabled={working} type="submit">
                  {working ? 'Salvando…' : 'Salvar coleção'}
                </button>
              </footer>
            </form>
          </dialog>
        )}

        {editingTeam && (
          <dialog
            aria-labelledby="team-dialog-title"
            className="ops-dialog"
            onClick={(event) => {
              if (event.target === event.currentTarget) setEditingTeam(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setEditingTeam(null);
            }}
            onClose={() => setEditingTeam(null)}
            ref={teamDialog}
          >
            <form className="ops-dialog-card" onSubmit={saveTeam}>
              <header>
                <div>
                  <p className="eyebrow">Time</p>
                  <h2 id="team-dialog-title">
                    {editingTeam === 'new' ? 'Novo time' : editingTeam.name}
                  </h2>
                  <p>
                    {editingTeam === 'new'
                      ? 'Cadastre a identidade usada nos cards.'
                      : 'Veja os jogadores vinculados e atualize a identidade usada nos cards.'}
                  </p>
                </div>
                <button aria-label="Fechar" onClick={() => setEditingTeam(null)} type="button">
                  ×
                </button>
              </header>
              <div className="ops-dialog-body drawer-form-grid two-columns">
                <label className="full-width">
                  Nome
                  <input
                    name="name"
                    onChange={(event) =>
                      setTeamPreview((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                    value={teamPreview.name}
                  />
                </label>
                <label>
                  Slug
                  <input
                    name="slug"
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    onChange={(event) =>
                      setTeamPreview((current) => ({ ...current, slug: event.target.value }))
                    }
                    required
                    title="Use letras minúsculas, números e hífens."
                    value={teamPreview.slug}
                  />
                </label>
                <label>
                  Símbolo
                  <input
                    name="emoji"
                    onChange={(event) =>
                      setTeamPreview((current) => ({ ...current, emoji: event.target.value }))
                    }
                    required
                    value={teamPreview.emoji}
                  />
                </label>
                <label>
                  Cor oficial
                  <input
                    name="color"
                    required
                    onChange={(event) => {
                      const color = event.target.value;
                      setTeamPreview((current) => ({
                        ...current,
                        color,
                        colors: [color, ...current.colors.slice(1)],
                      }));
                    }}
                    type="color"
                    value={teamPreview.color}
                  />
                </label>
                <label className="full-width">
                  URL do escudo
                  <input
                    value={teamPreview.imageUrl}
                    name="imageUrl"
                    placeholder="https://"
                    onChange={(event) =>
                      setTeamPreview((current) => ({ ...current, imageUrl: event.target.value }))
                    }
                    type="url"
                  />
                </label>
                <section
                  aria-busy={teamLogoSuggestionsStatus === 'loading'}
                  aria-live="polite"
                  aria-labelledby="team-logo-suggestions-title"
                  className="team-logo-suggestions full-width"
                >
                  <header>
                    <div>
                      <p className="eyebrow" id="team-logo-suggestions-title">
                        Importar do FootyLogos
                      </p>
                      <small>Preencha nome, slug, símbolo, paleta e escudo SVG em um clique.</small>
                    </div>
                    <a
                      href={`https://www.footylogos.com/logos?q=${encodeURIComponent(teamPreview.name)}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Abrir busca
                    </a>
                  </header>
                  {teamLogoSuggestionsStatus === 'loading' ? (
                    <p className="team-logo-suggestions-empty">Buscando escudos…</p>
                  ) : teamLogoSuggestions.length ? (
                    <ul>
                      {teamLogoSuggestions.map((suggestion) => (
                        <li key={suggestion.sourceUrl}>
                          <div className="team-logo-suggestion-copy">
                            <img alt="" src={suggestion.imageUrl} />
                            <span>
                              <strong>{suggestion.name}</strong>
                              <small>{suggestion.description}</small>
                            </span>
                          </div>
                          <div className="team-logo-suggestion-actions">
                            <button
                              onClick={() =>
                                setTeamPreview((current) => ({
                                  ...current,
                                  imageUrl: suggestion.imageUrl,
                                }))
                              }
                              type="button"
                            >
                              Só escudo
                            </button>
                            <button
                              className="is-primary"
                              disabled={Boolean(teamLogoImporting)}
                              onClick={() => void importTeamIdentity(suggestion)}
                              type="button"
                            >
                              {teamLogoImporting === suggestion.slug
                                ? 'Importando…'
                                : 'Importar tudo'}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="team-logo-suggestions-empty">
                      {teamLogoSuggestionsStatus === 'error'
                        ? 'Não foi possível carregar sugestões agora.'
                        : teamPreview.name.trim().length < 2
                          ? 'Digite pelo menos duas letras do nome do time.'
                          : 'Nenhum escudo correspondente foi encontrado.'}
                    </p>
                  )}
                </section>
                <section aria-live="polite" className="team-identity-preview full-width">
                  <span
                    className="team-identity-mark"
                    style={{ backgroundColor: teamPreview.color }}
                  >
                    {teamPreview.imageUrl ? (
                      <img alt="" src={teamPreview.imageUrl} />
                    ) : (
                      teamPreview.emoji || 'FC'
                    )}
                  </span>
                  <div>
                    <p className="eyebrow">Prévia no catálogo</p>
                    <strong>{teamPreview.name || 'Nome do time'}</strong>
                    <span>{teamPreview.slug || 'slug-do-time'}</span>
                  </div>
                  <span className="team-identity-color">
                    <span
                      className="team-identity-swatches"
                      aria-label={`Paleta: ${teamPreview.colors.join(', ')}`}
                    >
                      {teamPreview.colors.map((color) => (
                        <i key={color} style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    {teamPreview.color.toUpperCase()}
                  </span>
                </section>
              </div>
              {editingTeam !== 'new' && (
                <section aria-live="polite" className="team-players">
                  <header>
                    <div>
                      <p className="eyebrow">Jogadores vinculados</p>
                      <h3>
                        {teamPlayers
                          ? `${teamPlayers.total} jogador${teamPlayers.total === 1 ? '' : 'es'}`
                          : 'Carregando jogadores…'}
                      </h3>
                    </div>
                  </header>
                  {teamPlayersLoading ? (
                    <p className="team-players-empty">Carregando jogadores…</p>
                  ) : teamPlayers?.items.length ? (
                    <ul>
                      {teamPlayers.items.map((card) => (
                        <li key={card.id}>
                          <strong>{card.name}</strong>
                          <span>
                            {card.position} · OVR {card.overall}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="team-players-empty">Este time ainda não tem jogadores.</p>
                  )}
                  <Pagination page={teamPlayers} onPageChange={loadTeamPlayersPage} />
                </section>
              )}
              <footer>
                <button
                  className="ops-button secondary"
                  onClick={() => setEditingTeam(null)}
                  type="button"
                >
                  Cancelar
                </button>
                <button className="ops-button accent" disabled={working} type="submit">
                  {working ? 'Salvando…' : 'Salvar time'}
                </button>
              </footer>
            </form>
          </dialog>
        )}
      </div>
    </section>
  );

  function field(name: string, placeholder = '', type = 'text', disabled = false) {
    return (
      <label key={name}>
        {labels[name]}
        <input
          autoComplete="off"
          disabled={disabled}
          maxLength={name === 'slug' || name === 'name' ? 100 : undefined}
          name={name}
          onChange={(event) => setForm({ ...form, [name]: event.target.value })}
          placeholder={placeholder}
          pattern={name === 'slug' ? '[a-z0-9]+(?:-[a-z0-9]+)*' : undefined}
          title={name === 'slug' ? 'Use letras minúsculas, números e hífens.' : undefined}
          required
          type={type}
          value={String(form[name] ?? '')}
        />
      </label>
    );
  }

  function selectField(name: string, options?: Reference[]) {
    return (
      <label key={name}>
        {labels[name]}
        <select
          name={name}
          onChange={(event) => setForm({ ...form, [name]: event.target.value })}
          required
          value={String(form[name] ?? '')}
        >
          <option value="">Selecione</option>
          {options?.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function positionField() {
    return (
      <label>
        Posição
        <select
          name="position"
          onChange={(event) => {
            const position = event.target.value;
            const secondaryPositions = selectedSecondaryPositions()
              .filter((secondary) => secondary !== position)
              .join(';');
            setForm({ ...form, position, secondaryPositions });
          }}
          value={String(form.position)}
        >
          {positions.map((position) => (
            <option key={position}>{position}</option>
          ))}
        </select>
      </label>
    );
  }
  function selectedSecondaryPositions(): string[] {
    return String(form.secondaryPositions)
      .split(';')
      .map((position) => position.trim())
      .filter(Boolean);
  }

  function secondaryPositionsField() {
    const selected = selectedSecondaryPositions();
    const available = positions.filter((position) => position !== form.position);
    return (
      <div className="position-multiselect-field">
        <span>Posições secundárias</span>
        <details className="position-multiselect">
          <summary>
            <span>{selected.length ? selected.join(', ') : 'Selecione posições'}</span>
            <small>
              {selected.length
                ? `${selected.length} selecionada${selected.length > 1 ? 's' : ''}`
                : 'Opcional'}
            </small>
          </summary>
          <div className="position-multiselect-options">
            {available.map((position) => (
              <label key={position}>
                <input
                  checked={selected.includes(position)}
                  onChange={(event) => {
                    const secondaryPositions = event.target.checked
                      ? [...selected, position]
                      : selected.filter((value) => value !== position);
                    setForm({ ...form, secondaryPositions: secondaryPositions.join(';') });
                  }}
                  type="checkbox"
                />
                <span>{position}</span>
              </label>
            ))}
          </div>
        </details>
      </div>
    );
  }

  function statField(name: StatName, className?: string) {
    return (
      <label className={className} key={name}>
        <span className="drawer-stat-label">
          <StatIcon name={name} />
          <span>
            <b>{statCodes[name]}</b>
            <small>{labels[name]}</small>
          </span>
        </span>
        <input
          aria-label={labels[name]}
          max={100}
          min={1}
          name={name}
          onChange={(event) => setForm({ ...form, [name]: event.target.value })}
          required
          type="number"
          value={String(form[name] ?? '')}
        />
      </label>
    );
  }
}

function CatalogRail({
  children,
  countLabel,
  description,
  eyebrow,
  id,
  onOpen,
  title,
  trackRef,
  variant,
}: Readonly<{
  children: ReactNode;
  countLabel: string;
  description: string;
  eyebrow?: string;
  id: string;
  onOpen: () => void;
  title: string;
  trackRef: RefObject<HTMLDivElement | null>;
  variant: 'players' | 'references';
}>) {
  return (
    <section aria-labelledby={`${id}-title`} className={`catalog-rail ${variant}`}>
      <header className="catalog-rail-header">
        <div>
          <p className="eyebrow">{eyebrow ?? `Em destaque · ${countLabel}`}</p>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="catalog-rail-actions">
          <button
            aria-controls="catalog-browser-dialog"
            aria-haspopup="dialog"
            className="catalog-view-all"
            onClick={onOpen}
            type="button"
          >
            Ver tudo
          </button>
          <span className="catalog-rail-arrows">
            <button
              aria-label="Voltar no carrossel"
              onClick={() => scrollRail(trackRef, -1)}
              type="button"
            >
              ←
            </button>
            <button
              aria-label="Avançar no carrossel"
              onClick={() => scrollRail(trackRef, 1)}
              type="button"
            >
              →
            </button>
          </span>
        </div>
      </header>
      <div className={`catalog-rail-track ${variant}`} ref={trackRef}>
        {children}
      </div>
    </section>
  );
}

function scrollRail(trackRef: RefObject<HTMLDivElement | null>, direction: -1 | 1) {
  const track = trackRef.current;
  if (!track) return;
  track.scrollBy({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    left: direction * Math.max(280, track.clientWidth * 0.78),
  });
}
function PlayerVault({
  catalog,
  filters,
  hasFilters,
  loading,
  onAdd,
  onClearFilters,
  onEdit,
  onFiltersChange,
  onOpenStudio,
  onPageChange,
  onQueryChange,
  onSearch,
  onSelect,
  page,
  recentCards,
  selectedCard,
}: Readonly<{
  catalog: Catalog | null;
  filters: CardFilters;
  hasFilters: boolean;
  loading: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
  onEdit: (card: Card) => void;
  onFiltersChange: (filters: CardFilters) => void;
  onOpenStudio: (card: Card) => void;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onSelect: (card: Card) => void;
  page: Page<Card> | null;
  recentCards: readonly Card[];
  selectedCard: Card | null;
}>) {
  const searchRef = useRef<HTMLInputElement>(null);
  const playerCount = page?.total ?? 0;
  const featuredCards = recentCards.slice(0, 4);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  return (
    <section className="player-vault" aria-label="Banco de jogadores">
      <form
        className="player-vault-command-bar"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <label className="player-vault-search">
          <span className="player-vault-search-mark" aria-hidden="true">
            ⌕
          </span>
          <span className="sr-only">Buscar jogador</span>
          <input
            autoComplete="off"
            placeholder="Buscar Messi, Inter Miami ou coleção…"
            ref={searchRef}
            onChange={(event) => onQueryChange(event.target.value)}
            type="search"
            value={filters.query ?? ''}
          />
          <kbd>⌘ K</kbd>
        </label>
      </form>

      <div className="player-vault-filter-row" aria-label="Filtros do catálogo">
        <button
          aria-pressed={!hasFilters}
          className="player-vault-filter-all"
          onClick={onClearFilters}
          type="button"
        >
          Todos
        </button>
        <label>
          <span>Time</span>
          <select
            onChange={(event) =>
              onFiltersChange({ ...filters, teamId: event.target.value || undefined })
            }
            value={filters.teamId ?? ''}
          >
            <option value="">Todos os times</option>
            {catalog?.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Posição</span>
          <select
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                position: (event.target.value as CardFilters['position']) || undefined,
              })
            }
            value={filters.position ?? ''}
          >
            <option value="">Todas as posições</option>
            {positions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </label>
        <label className="player-vault-sort">
          <span>Ordenar</span>
          <select
            onChange={(event) =>
              onFiltersChange({ ...filters, sort: event.target.value as CardFilters['sort'] })
            }
            value={filters.sort ?? 'recent'}
          >
            <option value="recent">Recentes</option>
            <option value="overall">Maior OVR</option>
            <option value="name">Nome, A–Z</option>
          </select>
        </label>
      </div>

      <aside className="player-vault-progress" aria-label={`${playerCount} jogadores cadastrados`}>
        <div>
          <p className="eyebrow">Seu elenco</p>
          <strong>{playerCount} jogadores cadastrados</strong>
          <span>Adicione mais jogadores para expandir sua coleção.</span>
        </div>
        <div className="player-vault-progress-marks" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => (
            <i className={index < Math.min(playerCount, 10) ? 'is-filled' : ''} key={index} />
          ))}
        </div>
      </aside>

      {featuredCards.length ? (
        <section className="player-vault-featured" aria-labelledby="player-vault-featured-title">
          <header>
            <div>
              <p className="eyebrow">Em destaque</p>
              <h2 id="player-vault-featured-title">Recém-chegados ao elenco</h2>
            </div>
            <span>Selecione um card para continuar</span>
          </header>
          <div className="player-vault-featured-grid">
            {featuredCards.map((card) => (
              <PlayerCardTile
                card={card}
                key={card.id}
                onEdit={onEdit}
                onInspect={onSelect}
                selected={selectedCard?.id === card.id}
                showEditAction={false}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="player-vault-gallery" aria-labelledby="player-vault-gallery-title">
        <header>
          <div>
            <p className="eyebrow">Todos os jogadores</p>
            <h2 id="player-vault-gallery-title">Seu banco de cards</h2>
          </div>
          <span>
            {playerCount} {playerCount === 1 ? 'jogador' : 'jogadores'}
          </span>
        </header>
        {loading ? (
          <div className="player-gallery-loading" aria-label="Carregando cards">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : page?.items.length ? (
          <div className="player-gallery-grid">
            {page.items.map((card) => (
              <PlayerCardTile
                card={card}
                key={card.id}
                onEdit={onEdit}
                onInspect={onSelect}
                selected={selectedCard?.id === card.id}
                showEditAction={false}
              />
            ))}
          </div>
        ) : (
          <BoardEmpty
            action={hasFilters ? 'Limpar filtros' : 'Adicionar jogador'}
            description={
              hasFilters
                ? 'Nenhum jogador corresponde aos filtros atuais.'
                : 'Adicione o primeiro jogador ao seu banco de cards.'
            }
            onAction={hasFilters ? onClearFilters : onAdd}
            title={hasFilters ? 'Nenhum jogador encontrado' : 'Seu elenco está começando'}
          />
        )}
        <Pagination page={page} onPageChange={onPageChange} />
      </section>

      {selectedCard ? (
        <aside className="player-vault-selection" aria-live="polite">
          <div>
            <span>Selecionado</span>
            <strong>{selectedCard.name}</strong>
            <small>
              {selectedCard.position} · {selectedCard.overall} OVR · {selectedCard.team.name}
            </small>
          </div>
          <div>
            <button
              className="ops-button secondary"
              onClick={() => onEdit(selectedCard)}
              type="button"
            >
              Editar card
            </button>
            <button
              className="ops-button accent"
              onClick={() => onOpenStudio(selectedCard)}
              type="button"
            >
              Abrir no Studio
            </button>
          </div>
        </aside>
      ) : null}
    </section>
  );
}

function PlayerCardTile({
  card,
  onEdit,
  onInspect,
  selected = false,
  showEditAction = true,
}: Readonly<{
  card: Card;
  onEdit: (card: Card) => void;
  onInspect: (card: Card) => void;
  selected?: boolean;
  showEditAction?: boolean;
}>) {
  return (
    <article className={`player-card${selected ? ' is-selected' : ''}`}>
      <button
        aria-label={`${selected ? 'Jogador selecionado:' : 'Selecionar'} ${card.name}`}
        aria-pressed={selected}
        className="player-tile"
        onClick={() => onInspect(card)}
        type="button"
      >
        <span className="player-tile-art">
          <img alt="" height={250} src={card.imageUrl} width={184} />
          <span className="player-tile-meta">
            <span className="player-tile-position">{card.position}</span>
            <span className="player-tile-references">
              <span aria-label={`Time: ${card.team.name}`}>
                {card.team.imageUrl ? (
                  <img alt="" height={30} src={card.team.imageUrl} width={30} />
                ) : (
                  '?'
                )}
              </span>
              <span aria-label={`Coleção: ${card.collection.name}`}>
                {card.collection.imageUrl ? (
                  <img alt="" height={30} src={card.collection.imageUrl} width={30} />
                ) : (
                  '?'
                )}
              </span>
            </span>
          </span>
          <span className="player-tile-overall">
            <small>OVR</small>
            {card.overall}
          </span>
        </span>
        <span className="player-tile-stats">
          {technicalStats.map((stat) => (
            <span aria-label={`${labels[stat]}: ${card[stat]}`} key={stat}>
              <small>{statCodes[stat]}</small>
              <b>{card[stat]}</b>
            </span>
          ))}
        </span>
      </button>
      <div className="player-card-details">
        <span>
          <strong>{card.name}</strong>
          <small>
            {card.team.name} · {card.collection.name}
          </small>
        </span>
        {showEditAction ? (
          <button aria-label={`Editar ${card.name}`} onClick={() => onEdit(card)} type="button">
            Editar
          </button>
        ) : null}
      </div>
    </article>
  );
}

function PlayerDetailDialog({
  card,
  catalog,
  dialogRef,
  form,
  mode,
  onCancelEdit,
  onChange,
  onClose,
  onEdit,
  onImageChange,
  onOpenCollection,
  onOpenStudio,
  onOpenTeam,
  onRemove,
  onSave,
  working,
}: Readonly<{
  card: Card | null;
  catalog: Catalog | null;
  dialogRef: RefObject<HTMLDialogElement | null>;
  form: FormValues;
  mode: DetailMode;
  onCancelEdit: () => void;
  onChange: (name: string, value: string | boolean) => void;
  onClose: () => void;
  onEdit: (card: Card) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenCollection: (card: Card) => void;
  onOpenStudio: (card: Card) => void;
  onOpenTeam: (card: Card) => void;
  onRemove: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  working: boolean;
}>) {
  const isEditing = mode === 'edit';
  const previewName = isEditing ? String(form.name || card?.name || '') : (card?.name ?? '');
  const previewPosition = isEditing
    ? String(form.position || card?.position || '')
    : (card?.position ?? '');
  const previewOverall = isEditing
    ? Number(form.overall) || card?.overall || 0
    : (card?.overall ?? 0);
  const nameParts = previewName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts.slice(0, -1).join(' ') || previewName;
  const lastName = nameParts.length > 1 ? nameParts.at(-1) : '';
  const secondaryPositions = String(form.secondaryPositions ?? '')
    .split(';')
    .map((position) => position.trim())
    .filter(Boolean);

  function changePosition(position: string) {
    onChange('position', position);
    onChange(
      'secondaryPositions',
      secondaryPositions.filter((secondary) => secondary !== position).join(';'),
    );
  }

  function toggleSecondaryPosition(position: string, checked: boolean) {
    const next = checked
      ? [...secondaryPositions, position]
      : secondaryPositions.filter((secondary) => secondary !== position);
    onChange('secondaryPositions', next.join(';'));
  }

  return (
    <dialog
      aria-labelledby="player-detail-title"
      className="player-detail-dialog"
      onClose={onClose}
      ref={dialogRef}
    >
      {card && (
        <article className="player-detail-shell">
          <section className="player-detail-stage" aria-label={`Card 3D de ${previewName}`}>
            <div className="player-detail-stage-label">
              <span>{isEditing ? 'Editando card' : 'Card de jogador'}</span>
              <span>{card.collection.name}</span>
            </div>
            <div className="player-detail-card-scene">
              <div className="player-detail-card-3d">
                <div className="player-detail-card-grid" />
                <div className="player-detail-card-rating">
                  <strong>{previewOverall}</strong>
                  <span>{previewPosition}</span>
                </div>
                <img alt="" className="player-detail-card-photo" src={card.imageUrl} />
                <div className="player-detail-card-name">
                  <span>{firstName}</span>
                  <strong>{lastName}</strong>
                </div>
                <div className="player-detail-card-foot">
                  <span>{card.team.name}</span>
                  <i />
                  <span>{card.collection.emoji}</span>
                </div>
              </div>
            </div>
            <p className="player-detail-stage-note">
              {isEditing
                ? 'A prévia acompanha nome, posição e overall antes de salvar.'
                : 'Passe o cursor pelo card para inclinar a prévia.'}
            </p>
          </section>

          <section className={`player-detail-content${isEditing ? ' is-editing' : ''}`}>
            {isEditing ? (
              <form className="player-detail-editor" onSubmit={onSave}>
                <header className="player-detail-header">
                  <div>
                    <p className="eyebrow">Editar jogador</p>
                    <h2 id="player-detail-title">{card.name}</h2>
                    <p>{card.slug}</p>
                  </div>
                  <button aria-label="Fechar detalhes" onClick={onClose} type="button">
                    ×
                  </button>
                </header>

                <div className="player-detail-editor-scroll">
                  <section className="player-detail-editor-section">
                    <header>
                      <div>
                        <p className="eyebrow">Identidade</p>
                        <h3>Dados do card</h3>
                      </div>
                      <label className="player-detail-image-action">
                        Trocar imagem
                        <input
                          accept="image/jpeg,image/png,image/webp"
                          disabled={working}
                          onChange={onImageChange}
                          type="file"
                        />
                      </label>
                    </header>
                    <label className="player-detail-editor-field full-width">
                      Nome
                      <input
                        autoComplete="off"
                        disabled={working}
                        maxLength={100}
                        onChange={(event) => onChange('name', event.target.value)}
                        required
                        value={String(form.name ?? '')}
                      />
                    </label>
                  </section>

                  <section className="player-detail-editor-section">
                    <header>
                      <div>
                        <p className="eyebrow">Vínculos</p>
                        <h3>Catálogo</h3>
                      </div>
                    </header>
                    <div className="player-detail-editor-grid">
                      <label className="player-detail-editor-field">
                        Coleção
                        <select
                          disabled={working}
                          onChange={(event) => onChange('collectionId', event.target.value)}
                          required
                          value={String(form.collectionId ?? '')}
                        >
                          <option value="">Selecione</option>
                          {catalog?.collections.map((collection) => (
                            <option key={collection.id} value={collection.id}>
                              {collection.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="player-detail-editor-field">
                        Time
                        <select
                          disabled={working}
                          onChange={(event) => onChange('teamId', event.target.value)}
                          required
                          value={String(form.teamId ?? '')}
                        >
                          <option value="">Selecione</option>
                          {catalog?.teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="player-detail-editor-field">
                        Posição
                        <select
                          disabled={working}
                          onChange={(event) => changePosition(event.target.value)}
                          value={String(form.position ?? '')}
                        >
                          {positions.map((position) => (
                            <option key={position}>{position}</option>
                          ))}
                        </select>
                      </label>
                      <div className="player-detail-secondary-positions">
                        <span>Posições secundárias</span>
                        <div>
                          {positions
                            .filter((position) => position !== form.position)
                            .map((position) => (
                              <label key={position}>
                                <input
                                  checked={secondaryPositions.includes(position)}
                                  disabled={working}
                                  onChange={(event) =>
                                    toggleSecondaryPosition(position, event.target.checked)
                                  }
                                  type="checkbox"
                                />
                                {position}
                              </label>
                            ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="player-detail-editor-section">
                    <header>
                      <div>
                        <p className="eyebrow">Desempenho</p>
                        <h3>Atributos</h3>
                      </div>
                      <span>1—100</span>
                    </header>
                    <div className="player-detail-editor-stats">
                      {stats.map((stat) => (
                        <label key={stat}>
                          <span className="player-detail-stat-icon">
                            <StatIcon name={stat} />
                          </span>
                          <span>
                            <small>{statCodes[stat]}</small>
                            <strong>{labels[stat]}</strong>
                          </span>
                          <input
                            aria-label={labels[stat]}
                            disabled={working}
                            max={100}
                            min={1}
                            onChange={(event) => onChange(stat, event.target.value)}
                            required
                            type="number"
                            value={String(form[stat] ?? '')}
                          />
                        </label>
                      ))}
                    </div>
                  </section>

                  <label className="player-detail-contract-toggle">
                    <input
                      checked={Boolean(form.contractsBlocked)}
                      disabled={working}
                      onChange={(event) => onChange('contractsBlocked', event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      <strong>Bloquear contratos</strong>
                      <small>Impede aplicação de contratos neste card.</small>
                    </span>
                  </label>
                </div>

                <footer className="player-detail-editor-footer">
                  <button
                    className="ops-button danger"
                    disabled={working}
                    onClick={onRemove}
                    type="button"
                  >
                    Remover
                  </button>
                  <div>
                    <button
                      className="ops-button secondary"
                      disabled={working}
                      onClick={onCancelEdit}
                      type="button"
                    >
                      Cancelar
                    </button>
                    <button className="ops-button accent" disabled={working} type="submit">
                      {working ? 'Salvando…' : 'Salvar alterações'}
                    </button>
                  </div>
                </footer>
              </form>
            ) : (
              <>
                <header className="player-detail-header">
                  <div>
                    <p className="eyebrow">Detalhe do jogador</p>
                    <h2 id="player-detail-title">{card.name}</h2>
                    <p>
                      {card.position} · {card.team.name}
                    </p>
                  </div>
                  <button aria-label="Fechar detalhes" onClick={onClose} type="button">
                    ×
                  </button>
                </header>

                <dl className="player-detail-facts">
                  <div>
                    <dt>OVR</dt>
                    <dd>{card.overall}</dd>
                  </div>
                  <div>
                    <dt>Posição</dt>
                    <dd>{card.position}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>{card.team.name}</dd>
                  </div>
                  <div>
                    <dt>Coleção</dt>
                    <dd>{card.collection.name}</dd>
                  </div>
                </dl>

                <section
                  className="player-detail-performance"
                  aria-labelledby="player-detail-performance-title"
                >
                  <header>
                    <div>
                      <p className="eyebrow">Leitura do card</p>
                      <h3 id="player-detail-performance-title">Atributos principais</h3>
                    </div>
                    <span>1—100</span>
                  </header>
                  <div className="player-detail-performance-body">
                    <PlayerRadarChart card={card} />
                    <div className="player-detail-stat-grid">
                      {radarStats.map((stat) => (
                        <div key={stat}>
                          <span className="player-detail-stat-icon">
                            <StatIcon name={stat} />
                          </span>
                          <span>
                            <small>{statCodes[stat]}</small>
                            <strong>{labels[stat]}</strong>
                          </span>
                          <b>{card[stat]}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section
                  className="player-detail-actions"
                  aria-labelledby="player-detail-actions-title"
                >
                  <header>
                    <p className="eyebrow">Atalhos</p>
                    <h3 id="player-detail-actions-title">Continue a jornada</h3>
                  </header>
                  <div>
                    <button className="is-primary" onClick={() => onOpenStudio(card)} type="button">
                      <span>
                        <small>Personalização</small>
                        <strong>Abrir no Studio</strong>
                      </span>
                      <b>↗</b>
                    </button>
                    <button onClick={() => onOpenTeam(card)} type="button">
                      <span>
                        <small>Vínculo atual</small>
                        <strong>Ver time</strong>
                      </span>
                      <b>↗</b>
                    </button>
                    <button onClick={() => onOpenCollection(card)} type="button">
                      <span>
                        <small>Edição do card</small>
                        <strong>Abrir coleção</strong>
                      </span>
                      <b>↗</b>
                    </button>
                    <button onClick={() => onEdit(card)} type="button">
                      <span>
                        <small>Dados e atributos</small>
                        <strong>Editar card</strong>
                      </span>
                      <b>↗</b>
                    </button>
                  </div>
                </section>
              </>
            )}
          </section>
        </article>
      )}
    </dialog>
  );
}

function PlayerRadarChart({ card }: Readonly<{ card: Card }>) {
  const center = 140;
  const radius = 94;
  const angleStep = (Math.PI * 2) / radarStats.length;
  const pointAt = (index: number, scale: number) => {
    const angle = angleStep * index - Math.PI / 2;
    return [
      center + Math.cos(angle) * radius * scale,
      center + Math.sin(angle) * radius * scale,
    ] as const;
  };
  const rings = [0.2, 0.4, 0.6, 0.8, 1].map((scale) => ({
    scale,
    points: radarStats
      .map((_, index) =>
        pointAt(index, scale)
          .map((coordinate) => coordinate.toFixed(2))
          .join(','),
      )
      .join(' '),
  }));
  const values = radarStats.map((stat) => Math.max(0, Math.min(100, card[stat])) / 100);
  const summary = radarStats.map((stat) => `${labels[stat]} ${card[stat]}`).join(', ');

  return (
    <figure className="player-radar-chart">
      <svg aria-label={`Radar de atributos: ${summary}`} role="img" viewBox="0 0 280 280">
        <title>Radar de atributos de {card.name}</title>
        <defs>
          <linearGradient id="player-radar-fill" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="var(--futhub-violet)" stopOpacity=".72" />
            <stop offset="1" stopColor="var(--futhub-violet-dark)" stopOpacity=".34" />
          </linearGradient>
        </defs>
        {rings.map((ring) => (
          <polygon className="player-radar-ring" key={ring.scale} points={ring.points} />
        ))}
        {radarStats.map((stat, index) => {
          const [x, y] = pointAt(index, 1);
          const [labelX, labelY] = pointAt(index, 1.22);
          return (
            <g key={stat}>
              <line className="player-radar-axis" x1={center} x2={x} y1={center} y2={y} />
              <text className="player-radar-label" textAnchor="middle" x={labelX} y={labelY}>
                {statCodes[stat]}
              </text>
            </g>
          );
        })}
        <polygon
          className="player-radar-area"
          points={values.map((value, index) => pointAt(index, value).join(',')).join(' ')}
        />
        {values.map((value, index) => {
          const [x, y] = pointAt(index, value);
          return (
            <circle className="player-radar-point" cx={x} cy={y} key={radarStats[index]} r="3" />
          );
        })}
      </svg>
      <figcaption>
        <span>Perfil técnico</span>
        <b>{card.overall} OVR</b>
      </figcaption>
    </figure>
  );
}

function ReferenceDetailDialog({
  detail,
  dialogRef,
  onClose,
  onEdit,
  onOpenPlayers,
}: Readonly<{
  detail: ReferenceDetail | null;
  dialogRef: RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  onEdit: () => void;
  onOpenPlayers: () => void;
}>) {
  if (!detail)
    return <dialog className="reference-detail-dialog" onClose={onClose} ref={dialogRef} />;

  const collection = detail.kind === 'collection' ? detail.data : null;
  const team = detail.kind === 'team' ? detail.data : null;
  const reference = detail.data;
  const artwork = collection ? (collection.bannerUrl ?? collection.imageUrl) : team?.imageUrl;
  const emblem = collection ? (collection.overlayUrl ?? collection.imageUrl) : team?.imageUrl;
  const palette = [
    ...new Set(
      collection
        ? [collection.primaryColor, collection.secondaryColor]
        : team?.colors.length
          ? team.colors
          : [team?.color ?? '#171717'],
    ),
  ];
  const primaryColor = palette[0] ?? '#171717';
  const secondaryColor = palette[1] ?? primaryColor;
  const kind = collection ? 'coleção' : 'time';

  return (
    <dialog
      aria-labelledby="reference-detail-title"
      className="reference-detail-dialog"
      onClose={onClose}
      ref={dialogRef}
    >
      <article className={`reference-detail-shell ${collection ? 'is-collection' : 'is-team'}`}>
        <section
          aria-label={`Identidade visual de ${reference.name}`}
          className="reference-detail-stage"
          style={{ background: `linear-gradient(145deg, ${primaryColor}, ${secondaryColor})` }}
        >
          {artwork && <img alt="" className="reference-detail-artwork" src={artwork} />}
          <div className="reference-detail-stage-label">
            <span>{collection ? 'Edição de cards' : 'Clube'}</span>
            <span>{reference.slug}</span>
          </div>
          <div className="reference-detail-mark" aria-hidden="true">
            {emblem ? <img alt="" src={emblem} /> : reference.emoji}
          </div>
          <div className="reference-detail-stage-footer">
            <span>
              {collection?.contractsBlocked ? 'Contratos bloqueados' : 'Identidade ativa'}
            </span>
            <i>
              {palette.map((color) => (
                <b key={color} style={{ backgroundColor: color }} />
              ))}
            </i>
          </div>
        </section>

        <section className="reference-detail-content">
          <header className="reference-detail-header">
            <div>
              <p className="eyebrow">Detalhes da {kind}</p>
              <h2 id="reference-detail-title">{reference.name}</h2>
              <p>
                {collection
                  ? 'Identidade visual e regras da edição.'
                  : 'Identidade visual do clube.'}
              </p>
            </div>
            <button
              aria-label={`Fechar detalhes de ${reference.name}`}
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </header>

          <dl className="reference-detail-facts">
            <div>
              <dt>Slug</dt>
              <dd>{reference.slug}</dd>
            </div>
            <div>
              <dt>{collection ? 'Contratos' : 'Escudo'}</dt>
              <dd>
                {collection
                  ? collection.contractsBlocked
                    ? 'Bloqueados'
                    : 'Liberados'
                  : team?.imageUrl
                    ? 'Configurado'
                    : 'Símbolo'}
              </dd>
            </div>
            <div>
              <dt>{collection ? 'Arte' : 'Paleta'}</dt>
              <dd>
                {collection
                  ? artwork
                    ? 'Configurada'
                    : 'Símbolo'
                  : `${palette.length} ${palette.length === 1 ? 'cor' : 'cores'}`}
              </dd>
            </div>
            <div>
              <dt>Cor base</dt>
              <dd>{primaryColor.toUpperCase()}</dd>
            </div>
          </dl>

          <section
            aria-labelledby="reference-detail-palette-title"
            className="reference-detail-palette"
          >
            <header>
              <div>
                <p className="eyebrow">Identidade</p>
                <h3 id="reference-detail-palette-title">Paleta da {kind}</h3>
              </div>
              <span>
                {palette.length} cor{palette.length === 1 ? '' : 'es'}
              </span>
            </header>
            <ul>
              {palette.map((color) => (
                <li key={color}>
                  <i style={{ backgroundColor: color }} />
                  <code>{color.toUpperCase()}</code>
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="reference-detail-actions-title"
            className="reference-detail-actions"
          >
            <header>
              <p className="eyebrow">Atalhos</p>
              <h3 id="reference-detail-actions-title">Continue a jornada</h3>
            </header>
            <div>
              <button className="is-primary" onClick={onOpenPlayers} type="button">
                <span>
                  <small>{collection ? 'Cards da edição' : 'Elenco atual'}</small>
                  <strong>{collection ? 'Ver jogadores' : 'Ver elenco'}</strong>
                </span>
                <b>↗</b>
              </button>
              <button onClick={onEdit} type="button">
                <span>
                  <small>Dados e identidade</small>
                  <strong>Editar {kind}</strong>
                </span>
                <b>↗</b>
              </button>
            </div>
          </section>
        </section>
      </article>
    </dialog>
  );
}
function PlayerSpotlight({
  card,
  onEdit,
  onExplore,
  onOpenCatalog,
}: Readonly<{
  card: Card;
  onEdit: (card: Card) => void;
  onExplore: (card: Card) => void;
  onOpenCatalog: () => void;
}>) {
  return (
    <section
      aria-labelledby="player-spotlight-title"
      className="collection-spotlight player-spotlight"
      style={{ '--collection-primary': 'var(--futhub-violet)' } as CSSProperties}
    >
      <header className="collection-spotlight-header">
        <p className="eyebrow">Adicionado por último</p>
        <button className="catalog-view-all" onClick={onOpenCatalog} type="button">
          Ver catálogo
        </button>
      </header>
      <div className="collection-spotlight-layout">
        <PlayerCardTile card={card} onEdit={onEdit} onInspect={onExplore} />
        <div className="collection-spotlight-copy">
          <p className="eyebrow">Jogador em destaque</p>
          <h2 id="player-spotlight-title">{card.name}</h2>
          <p>
            {card.team.name} · {card.collection.name}
          </p>
          <dl className="collection-spotlight-facts player-spotlight-facts">
            <div>
              <dt>Overall</dt>
              <dd>{card.overall}</dd>
            </div>
            <div>
              <dt>Posição</dt>
              <dd>{card.position}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{card.team.name}</dd>
            </div>
          </dl>
          <button
            className="ops-button accent collection-spotlight-explore"
            onClick={() => onExplore(card)}
            type="button"
          >
            Explorar jogador <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function TeamSpotlight({
  onExplore,
  onOpenCatalog,
  team,
}: Readonly<{
  onExplore: (team: Team) => void;
  onOpenCatalog: () => void;
  team: Team;
}>) {
  const spotlightStyle = {
    '--collection-primary': team.color,
    background: `linear-gradient(135deg, ${team.color}, var(--surface-dark))`,
  } as CSSProperties;

  return (
    <section
      aria-labelledby="team-spotlight-title"
      className="collection-spotlight team-spotlight"
      style={{ '--collection-primary': team.color } as CSSProperties}
    >
      <header className="collection-spotlight-header">
        <p className="eyebrow">Adicionado por último</p>
        <button className="catalog-view-all" onClick={onOpenCatalog} type="button">
          Ver catálogo
        </button>
      </header>
      <div className="collection-spotlight-layout">
        <article
          aria-label={`Identidade do time ${team.name}`}
          className="collection-spotlight-card team-spotlight-card"
          style={spotlightStyle}
        >
          {team.imageUrl && (
            <img alt="" className="collection-spotlight-artwork" src={team.imageUrl} />
          )}
          <div className="collection-spotlight-card-top">
            <span aria-hidden="true" className="collection-tile-symbol">
              {team.imageUrl ? <img alt="" src={team.imageUrl} /> : team.emoji}
            </span>
            <small>Clube</small>
          </div>
          <span className="collection-tile-contracts">
            <i style={{ backgroundColor: team.imageUrl ? '#fff' : 'transparent' }} />
            {team.imageUrl ? 'Escudo configurado' : 'Símbolo de fallback'}
          </span>
        </article>
        <div className="collection-spotlight-copy">
          <p className="eyebrow">Time em destaque</p>
          <h2 id="team-spotlight-title">{team.name}</h2>
          <p>Identidade disponível para os cards do clube.</p>
          <dl className="collection-spotlight-facts">
            <div>
              <dt>Escudo</dt>
              <dd>{team.imageUrl ? 'Configurado' : 'Pendente'}</dd>
            </div>
            <div>
              <dt>Paleta</dt>
              <dd>{team.colors.length} cores</dd>
            </div>
          </dl>
          <button
            className="ops-button accent collection-spotlight-explore"
            onClick={() => onExplore(team)}
            type="button"
          >
            Explorar time <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function CollectionSpotlight({
  collection,
  onExplore,
  onOpenCatalog,
}: Readonly<{
  collection: Collection;
  onExplore: (collection: Collection) => void;
  onOpenCatalog: () => void;
}>) {
  const artwork = collection.bannerUrl ?? collection.imageUrl;
  const spotlightStyle = {
    '--collection-primary': collection.primaryColor,
    '--collection-secondary': collection.secondaryColor,
    background: `linear-gradient(135deg, ${collection.primaryColor}, ${collection.secondaryColor})`,
  } as CSSProperties;

  return (
    <section
      aria-labelledby="collection-spotlight-title"
      className="collection-spotlight"
      style={{ '--collection-primary': collection.primaryColor } as CSSProperties}
    >
      <header className="collection-spotlight-header">
        <p className="eyebrow">Recentemente adicionada</p>
        <button className="catalog-view-all" onClick={onOpenCatalog} type="button">
          Ver catálogo
        </button>
      </header>
      <div className="collection-spotlight-layout">
        <article
          aria-label={`Arte da coleção ${collection.name}`}
          className="collection-spotlight-card"
          style={spotlightStyle}
        >
          {artwork && <img alt="" className="collection-spotlight-artwork" src={artwork} />}
          <div className="collection-spotlight-card-top">
            <span aria-hidden="true" className="collection-tile-symbol">
              {collection.emoji}
            </span>
            <small>Edição do jogo</small>
          </div>
          <span className="collection-tile-contracts">
            <i style={{ backgroundColor: collection.contractsBlocked ? '#fff' : 'transparent' }} />
            {collection.contractsBlocked ? 'Contratos bloqueados' : 'Contratos liberados'}
          </span>
        </article>
        <div className="collection-spotlight-copy">
          <p className="eyebrow">Coleção em destaque</p>
          <h2 id="collection-spotlight-title">{collection.name}</h2>
          <p>Uma identidade visual para agrupar os cards desta edição.</p>
          <dl className="collection-spotlight-facts">
            <div>
              <dt>Contratos</dt>
              <dd>{collection.contractsBlocked ? 'Bloqueados' : 'Liberados'}</dd>
            </div>
            <div>
              <dt>Identidade</dt>
              <dd>{artwork ? 'Arte configurada' : 'Cores definidas'}</dd>
            </div>
          </dl>
          <button
            className="ops-button accent collection-spotlight-explore"
            onClick={() => onExplore(collection)}
            type="button"
          >
            Explorar coleção <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function GalleryStart({
  action,
  description,
  onAction,
  title,
}: Readonly<{
  action: string;
  description: string;
  onAction: () => void;
  title: string;
}>) {
  return (
    <aside className="collection-gallery-start">
      <span aria-hidden="true" className="collection-gallery-start-mark">
        +
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button className="collection-gallery-start-action" onClick={onAction} type="button">
        {action} <span aria-hidden="true">→</span>
      </button>
    </aside>
  );
}

function CollectionCardTile({
  collection,
  index,
  onInspect,
  onRemove,
  working,
}: Readonly<{
  collection: Collection;
  index: number;
  onInspect: (collection: Collection) => void;
  onRemove: (collection: Collection) => void | Promise<void>;
  working: boolean;
}>) {
  const artwork = collection.bannerUrl ?? collection.imageUrl;
  const tileStyle = {
    '--collection-delay': `${index * 60}ms`,
    '--collection-primary': collection.primaryColor,
    '--collection-secondary': collection.secondaryColor,
    background: `linear-gradient(135deg, ${collection.primaryColor}, ${collection.secondaryColor})`,
  } as CSSProperties;

  return (
    <article className="collection-tile" style={tileStyle}>
      <div className="collection-tile-cover">
        {artwork && <img alt="" className="collection-tile-artwork" src={artwork} />}
        <div className="collection-tile-cover-content">
          <span aria-hidden="true" className="collection-tile-symbol">
            {collection.emoji}
          </span>
          <div>
            <small className="collection-tile-kind">Edição do jogo</small>
            <strong>{collection.name}</strong>
          </div>
        </div>
        <div className="collection-tile-overlay">
          <span className="collection-tile-contracts">
            <i style={{ backgroundColor: collection.contractsBlocked ? '#fff' : 'transparent' }} />
            {collection.contractsBlocked ? 'Contratos bloqueados' : 'Contratos liberados'}
          </span>
          <div className="collection-tile-actions">
            <button
              aria-label={`Explorar ${collection.name}`}
              className="collection-tile-manage"
              onClick={() => onInspect(collection)}
              type="button"
            >
              Explorar <span aria-hidden="true">→</span>
            </button>
            <button
              aria-label={`Remover ${collection.name}`}
              className="collection-tile-remove"
              disabled={working}
              onClick={() => void onRemove(collection)}
              title="Remover coleção"
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function TeamCardTile({
  index,
  onInspect,
  onRemove,
  team,
  working,
}: Readonly<{
  index: number;
  onInspect: (team: Team) => void;
  onRemove: (team: Team) => void | Promise<void>;
  team: Team;
  working: boolean;
}>) {
  const tileStyle = {
    '--collection-delay': `${index * 60}ms`,
    '--collection-primary': team.color,
    background: `linear-gradient(135deg, ${team.color}, var(--surface-dark))`,
  } as CSSProperties;

  return (
    <article className="collection-tile team-tile" style={tileStyle}>
      <div className="collection-tile-cover">
        {team.imageUrl ? (
          <img alt="" className="collection-tile-artwork" src={team.imageUrl} />
        ) : null}
        <div className="collection-tile-cover-content">
          <span aria-hidden="true" className="collection-tile-symbol">
            {team.imageUrl ? <img alt="" src={team.imageUrl} /> : team.emoji}
          </span>
          <div>
            <small className="collection-tile-kind">Clube</small>
            <strong>{team.name}</strong>
          </div>
        </div>
        <div className="collection-tile-overlay">
          <span className="collection-tile-contracts">
            <i style={{ backgroundColor: team.imageUrl ? '#fff' : 'transparent' }} />
            {team.imageUrl ? 'Escudo configurado' : 'Símbolo de fallback'}
          </span>
          <div className="collection-tile-actions">
            <button
              aria-label={`Explorar ${team.name}`}
              className="collection-tile-manage"
              onClick={() => onInspect(team)}
              type="button"
            >
              Explorar <span aria-hidden="true">→</span>
            </button>
            <button
              aria-label={`Remover ${team.name}`}
              className="collection-tile-remove"
              disabled={working}
              onClick={() => void onRemove(team)}
              title="Remover time"
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CatalogImportWorkspace({
  file,
  onFileChange,
  onPublish,
  onRetry,
  phase,
  preview,
  revealedChecks,
}: Readonly<{
  file: File | null;
  onFileChange: (file: File | null) => void;
  onPublish: () => void;
  onRetry: () => void;
  phase: ImportPhase;
  preview: Preview | null;
  revealedChecks: number;
}>) {
  const isAnalyzing = phase === 'validating' || phase === 'revealing';
  const isOutcome = ['success', 'success-with-warnings', 'validation-error'].includes(phase);
  const fileSize = file
    ? file.size < 1024 * 1024
      ? `${Math.max(1, Math.round(file.size / 1024))} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    : '';
  const statusLine =
    phase === 'validating'
      ? 'Arquivo enviado. Aguardando o resultado da validação do servidor.'
      : phase === 'revealing'
        ? 'Resultado recebido. Organizando as verificações do catálogo.'
        : phase === 'publishing'
          ? 'Publicando as alterações no catálogo…'
          : phase === 'unexpected-error'
            ? 'A validação não pôde ser concluída. Tente novamente ou escolha outro arquivo.'
            : isOutcome
              ? 'Validação concluída. Revise o resultado antes de seguir.'
              : 'Selecione uma planilha para iniciar a análise.';
  const changedCards = (preview?.createCount ?? 0) + (preview?.updateCount ?? 0);
  const createShare = changedCards ? ((preview?.createCount ?? 0) / changedCards) * 100 : 0;
  const updateShare = changedCards ? ((preview?.updateCount ?? 0) / changedCards) * 100 : 0;

  return (
    <div
      className={`import-workspace phase-${phase}`}
      aria-busy={isAnalyzing || phase === 'publishing'}
    >
      <label className={`import-file-stage ${file ? 'selected' : ''}`}>
        <input
          accept=".xlsx"
          disabled={phase === 'publishing'}
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          type="file"
        />
        <span className="import-file-mark">XLSX</span>
        <span className="import-file-copy">
          <strong>{file?.name ?? 'Arraste ou selecione a planilha'}</strong>
          <small>
            {file
              ? `${fileSize} · selecionar outro arquivo`
              : 'Somente o modelo oficial em formato .xlsx.'}
          </small>
        </span>
        {file && <span className="import-file-change">Trocar</span>}
      </label>

      {file && !isOutcome && (
        <section aria-labelledby="catalog-analysis-title" className="catalog-analysis">
          <header className="analysis-header">
            <div>
              <p className="eyebrow">Modo de análise</p>
              <h2 id="catalog-analysis-title">
                {isAnalyzing
                  ? 'Catálogo sob análise'
                  : phase === 'unexpected-error'
                    ? 'A análise foi interrompida'
                    : 'Análise do catálogo'}
              </h2>
            </div>
            <span className={`analysis-status ${isAnalyzing ? 'live' : ''}`} aria-live="polite">
              <i />
              {isAnalyzing
                ? 'Em processamento'
                : phase === 'unexpected-error'
                  ? 'Requer ação'
                  : 'Concluída'}
            </span>
          </header>

          <div className="analysis-surface" aria-hidden="true">
            <div className="analysis-sheet">
              <span className="analysis-sheet-head">A</span>
              <span className="analysis-sheet-head">B</span>
              <span className="analysis-sheet-head">C</span>
              <span className="analysis-sheet-head">D</span>
              {Array.from({ length: 20 }, (_, index) => (
                <i key={index} />
              ))}
              <b className="analysis-scanner" />
            </div>
            <div className="analysis-packets">
              <span>JOG</span>
              <span>TIM</span>
              <span>COL</span>
            </div>
          </div>

          <p className="analysis-stream" aria-live="polite">
            <span aria-hidden="true" />
            {statusLine}
          </p>

          <ol className="analysis-checklist">
            {validationStages.map((stage, index) => {
              const status = validationStageStatus(stage.id, index, phase, preview, revealedChecks);
              const detail =
                status === 'complete'
                  ? 'Concluída'
                  : status === 'error'
                    ? 'Requer atenção'
                    : status === 'active'
                      ? 'Analisando…'
                      : stage.detail;
              return (
                <li className={status} key={stage.id}>
                  <span className="analysis-check-icon" aria-hidden="true">
                    {status === 'complete' ? '✓' : status === 'error' ? '!' : ''}
                  </span>
                  <span>
                    <b>{stage.label}</b>
                    <small>{detail}</small>
                  </span>
                </li>
              );
            })}
          </ol>

          {phase === 'unexpected-error' && (
            <div className="analysis-retry" role="alert">
              <div>
                <strong>Não foi possível concluir a validação.</strong>
                <span>
                  O arquivo continua selecionado. Tente novamente ou escolha outra planilha.
                </span>
              </div>
              <button className="ops-button secondary" onClick={onRetry} type="button">
                Tentar novamente
              </button>
            </div>
          )}
        </section>
      )}

      {isOutcome && preview && (
        <section
          aria-live="polite"
          className={`import-outcome ${preview.valid ? 'success' : 'error'}`}
        >
          <header>
            <span className="outcome-mark" aria-hidden="true">
              {preview.valid ? '✓' : '!'}
            </span>
            <div>
              <p className="eyebrow">
                {preview.valid ? 'Validação concluída' : 'Diagnóstico pronto'}
              </p>
              <h2>
                {preview.valid
                  ? preview.errors.length
                    ? 'Catálogo pronto, com avisos'
                    : 'Catálogo pronto para publicação'
                  : 'Encontramos pontos que precisam de atenção'}
              </h2>
              <p>
                {preview.valid
                  ? 'Os dados podem seguir para a publicação.'
                  : 'Corrija os registros abaixo e selecione a planilha novamente.'}
              </p>
            </div>
          </header>

          <dl>
            <div>
              <dt>Novos cards</dt>
              <dd>
                <AnimatedCount value={preview.createCount} />
              </dd>
            </div>
            <div>
              <dt>Atualizações</dt>
              <dd>
                <AnimatedCount value={preview.updateCount} />
              </dd>
            </div>
            <div>
              <dt>{preview.valid ? 'Ocorrências' : 'Erros'}</dt>
              <dd>
                <AnimatedCount value={preview.errors.length} />
              </dd>
            </div>
          </dl>
          <section aria-labelledby="import-impact-title" className="import-impact-preview">
            <header>
              <div>
                <p className="eyebrow" id="import-impact-title">
                  Impacto da publicação
                </p>
                <strong>
                  {changedCards} card{changedCards === 1 ? '' : 's'} serão alterados
                </strong>
              </div>
              <span>
                {preview.errors.length
                  ? `${preview.errors.length} ocorrência${preview.errors.length === 1 ? '' : 's'} para revisar`
                  : 'Sem pendências'}
              </span>
            </header>
            <ul>
              <li data-kind="create">
                <div>
                  <span>Criações</span>
                  <b>{preview.createCount}</b>
                </div>
                <div
                  aria-label={`${preview.createCount} cards serão criados`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={createShare}
                  className="import-impact-track"
                  role="progressbar"
                >
                  <i style={{ width: `${createShare}%` }} />
                </div>
              </li>
              <li data-kind="update">
                <div>
                  <span>Atualizações</span>
                  <b>{preview.updateCount}</b>
                </div>
                <div
                  aria-label={`${preview.updateCount} cards serão atualizados`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={updateShare}
                  className="import-impact-track"
                  role="progressbar"
                >
                  <i style={{ width: `${updateShare}%` }} />
                </div>
              </li>
            </ul>
          </section>

          {preview.errors.length > 0 && (
            <ol className="import-issues">
              {preview.errors.slice(0, 8).map((error, index) => (
                <li
                  key={`${error.row}-${error.field}`}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <code>L{error.row}</code>
                  <span>
                    <b>{error.field}</b>
                    {error.message}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {preview.valid ? (
            <footer>
              <span>Revise o impacto acima. A publicação aplica a planilha ao catálogo.</span>
              <button
                className="ops-button accent"
                disabled={phase === 'publishing'}
                onClick={onPublish}
                type="button"
              >
                {phase === 'publishing' ? 'Publicando…' : 'Publicar catálogo'}
              </button>
            </footer>
          ) : (
            <footer>
              <span>
                Depois da correção, escolha a nova versão da planilha para validar novamente.
              </span>
            </footer>
          )}
        </section>
      )}
    </div>
  );
}

function AnimatedCount({ value }: Readonly<{ value: number }>) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(value);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const duration = 560;
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      setDisplayed(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return displayed;
}

function validationStageStatus(
  stage: (typeof validationStages)[number]['id'],
  index: number,
  phase: ImportPhase,
  preview: Preview | null,
  revealedChecks: number,
): ValidationStageStatus {
  if (phase === 'validating') return index === 0 ? 'active' : 'waiting';
  if (phase === 'unexpected-error') return 'waiting';
  if (!preview) return 'waiting';
  if (phase === 'revealing' && index >= revealedChecks) {
    return index === revealedChecks ? 'active' : 'waiting';
  }
  return stageHasError(stage, preview.errors) ? 'error' : 'complete';
}

function stageHasError(
  stage: (typeof validationStages)[number]['id'],
  errors: Preview['errors'],
): boolean {
  const patterns = {
    structure: /arquivo|planilha|aba|sheet/i,
    columns: /coluna|cabeçalho/i,
    cards: /jogador|registro|nome|posição|atributo|overall/i,
    references: /time|team|coleção|collection|referência/i,
    duplicates: /duplicad|slug|identificador/i,
  } as const;
  return errors.some((error) => patterns[stage].test(`${error.field} ${error.message}`));
}

function StatIcon({ name }: Readonly<{ name: StatName }>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      {statIconPaths[name].map((path) => (
        <path
          d={path}
          key={path}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      ))}
    </svg>
  );
}

function BoardEmpty({
  action,
  description,
  onAction,
  title,
}: Readonly<{ action: string; description: string; onAction: () => void; title: string }>) {
  return (
    <div className="board-empty">
      <span aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="ops-button secondary" onClick={onAction} type="button">
        {action}
      </button>
    </div>
  );
}

function Pagination<T>({
  page,
  onPageChange,
}: Readonly<{ page: Page<T> | null; onPageChange: (page: number) => void }>) {
  if (!page || page.total <= page.pageSize) return null;
  const pages = Math.ceil(page.total / page.pageSize);
  return (
    <nav className="ops-pagination" aria-label="Paginação">
      <button disabled={page.page === 1} onClick={() => onPageChange(page.page - 1)} type="button">
        Anterior
      </button>
      <span>
        Página {page.page} de {pages}
      </span>
      <button
        disabled={page.page === pages}
        onClick={() => onPageChange(page.page + 1)}
        type="button"
      >
        Próxima
      </button>
    </nav>
  );
}

function syncDialog(dialog: HTMLDialogElement | null, visible: boolean) {
  if (!dialog) return;
  if (visible && !dialog.open) {
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
  }
  if (!visible && dialog.open) dialog.close();
}

function emptyForm(): FormValues {
  return {
    slug: '',
    name: '',
    collectionId: '',
    teamId: '',
    position: 'CA',
    secondaryPositions: '',
    contractsBlocked: false,
    defense: '60',
    attack: '60',
    creation: '60',
    overall: '60',
    passing: '60',
    control: '60',
    marking: '60',
    pace: '60',
    dribbling: '60',
    finishing: '60',
  };
}

function cardForm(card: Card): FormValues {
  return {
    slug: card.slug,
    name: card.name,
    collectionId: card.collection.id,
    teamId: card.team.id,
    position: card.position,
    secondaryPositions: card.secondaryPositions.join(';'),
    contractsBlocked: card.contractsBlocked,
    defense: String(card.defense),
    attack: String(card.attack),
    creation: String(card.creation),
    overall: String(card.overall),
    passing: String(card.passing),
    control: String(card.control),
    marking: String(card.marking),
    pace: String(card.pace),
    dribbling: String(card.dribbling),
    finishing: String(card.finishing),
  };
}

function requestBody(form: FormValues) {
  const body: Record<string, unknown> = {
    ...form,
    secondaryPositions: String(form.secondaryPositions)
      .split(';')
      .map((value) => value.trim())
      .filter(Boolean),
    contractsBlocked: Boolean(form.contractsBlocked),
  };
  for (const stat of stats) body[stat] = Number(form[stat]);
  return body;
}

function withoutSlug(body: Record<string, unknown>) {
  const { slug: _, ...result } = body;
  return result;
}

function workbookForm(file: File): FormData {
  const data = new FormData();
  data.append('file', file);
  return data;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(data: FormData, name: string): string | null {
  return text(data, name) || null;
}
