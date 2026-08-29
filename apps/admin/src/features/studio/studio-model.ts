export const positions = ['GOL', 'LD', 'LE', 'ZAG', 'VOL', 'MA', 'MC', 'PD', 'PE', 'CA'] as const;

export const statFields = [
  ['pace', 'Ritmo', 'RIT'],
  ['finishing', 'Finalização', 'FIN'],
  ['passing', 'Passe', 'PAS'],
  ['dribbling', 'Drible', 'DRI'],
  ['marking', 'Marcação', 'MAR'],
  ['control', 'Controle', 'CON'],
] as const;

export type StatKey = (typeof statFields)[number][0];
export type InspectorPanel = 'data' | 'photo' | 'visual' | 'layers';
export type CardStyle = 'elite' | 'signature' | 'midnight' | 'velocity';
export type CardFinish = 'matte' | 'foil' | 'holo' | 'chrome' | 'energy' | 'retro';
export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'icon';
export type PhotoFormat = 'png' | 'other' | 'missing';
export const playerImageSpecification = {
  height: 1200,
  mimeType: 'image/png',
  width: 1200,
} as const;

export type PreviewMode = 'isolated' | 'discord' | 'mobile' | 'artwork';
export type StudioAssetKind =
  | 'ea-fc-item'
  | 'futgg-item'
  | 'simple-card'
  | 'social-image'
  | 'share-image'
  | 'player-image';

export type StudioAssetDefinition = Readonly<{
  id: StudioAssetKind;
  label: string;
  description: string;
  width: number;
  height: number;
  transparent: boolean;
}>;
export type LayerKey =
  | 'background'
  | 'effects'
  | 'photo'
  | 'rating'
  | 'badges'
  | 'identity'
  | 'stats';

export type StudioDraft = Readonly<{
  name: string;
  overall: number;
  position: string;
  teamName: string;
  teamLogoUrl: string;
  collectionName: string;
  collectionLogoUrl: string;
  playerImageUrl: string;
  photoFormat: PhotoFormat;
  photoIsStandard: boolean;
  primaryColor: string;
  secondaryColor: string;
  style: CardStyle;
  finish: CardFinish;
  rarity: CardRarity;
  photoScale: number;
  photoX: number;
  photoY: number;
  ratingX: number;
  ratingY: number;
  identityX: number;
  identityY: number;
  statsX: number;
  statsY: number;
  pace: number;
  finishing: number;
  passing: number;
  dribbling: number;
  marking: number;
  control: number;
  layerVisibility: Readonly<Record<LayerKey, boolean>>;
  layerLocks: Readonly<Record<LayerKey, boolean>>;
  layerOrder: readonly LayerKey[];
}>;

export type StudioPreset = Readonly<{
  id: string;
  label: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  style: CardStyle;
  finish: CardFinish;
  rarity: CardRarity;
}>;

export type InspectorCheck = Readonly<{
  id: string;
  label: string;
  detail: string;
  status: 'ready' | 'warning' | 'blocked';
  panel: InspectorPanel;
}>;
export const studioAssetDefinitions: readonly StudioAssetDefinition[] = [
  {
    id: 'ea-fc-item',
    label: 'EA FC Item',
    description: 'Card completo com fundo transparente',
    width: 600,
    height: 800,
    transparent: true,
  },
  {
    id: 'futgg-item',
    label: 'FUTGG Item',
    description: 'Card completo com marcadores laterais',
    width: 600,
    height: 800,
    transparent: true,
  },
  {
    id: 'simple-card',
    label: 'Card simples',
    description: 'Nota, foto e identidade sem painel de stats',
    width: 600,
    height: 800,
    transparent: true,
  },
  {
    id: 'social-image',
    label: 'Imagem social',
    description: 'Composição horizontal para links e posts',
    width: 1200,
    height: 630,
    transparent: false,
  },
  {
    id: 'share-image',
    label: 'Imagem de compartilhamento',
    description: 'Arte quadrada com card e atributos',
    width: 1080,
    height: 1080,
    transparent: false,
  },
  {
    id: 'player-image',
    label: 'Imagem do jogador',
    description: 'Recorte do jogador em PNG transparente de 1200 × 1200',
    width: playerImageSpecification.width,
    height: playerImageSpecification.height,
    transparent: true,
  },
];

export function studioAssetSize(
  kind: StudioAssetKind,
  requestedWidth?: number,
): Readonly<{ width: number; height: number }> {
  const asset = studioAssetDefinitions.find((candidate) => candidate.id === kind);
  if (!asset) throw new Error(`Tipo de imagem desconhecido: ${kind}`);
  const width = Math.min(2400, Math.max(300, Math.round(requestedWidth ?? asset.width)));
  return { width, height: Math.round((width * asset.height) / asset.width) };
}

export const layerDefinitions: readonly Readonly<{
  id: LayerKey;
  label: string;
  description: string;
  panel: InspectorPanel;
}>[] = [
  { id: 'background', label: 'Background', description: 'Base e painel de dados', panel: 'visual' },
  {
    id: 'effects',
    label: 'Texture / Effects',
    description: 'Overlay e acabamento',
    panel: 'visual',
  },
  { id: 'photo', label: 'Player Photo', description: 'Recorte principal', panel: 'photo' },
  { id: 'rating', label: 'Overall', description: 'Nota e posição', panel: 'data' },
  { id: 'badges', label: 'Badges', description: 'Time e coleção', panel: 'data' },
  { id: 'identity', label: 'Name', description: 'Nome e contexto', panel: 'data' },
  { id: 'stats', label: 'Stats', description: 'Atributos do jogador', panel: 'data' },
];

const defaultLayerVisibility: Readonly<Record<LayerKey, boolean>> = {
  background: true,
  effects: true,
  photo: true,
  rating: true,
  badges: true,
  identity: true,
  stats: true,
};

const defaultLayerLocks: Readonly<Record<LayerKey, boolean>> = {
  background: true,
  effects: false,
  photo: false,
  rating: false,
  badges: true,
  identity: false,
  stats: false,
};

export const defaultLayerOrder: readonly LayerKey[] = [
  'background',
  'effects',
  'photo',
  'rating',
  'badges',
  'identity',
  'stats',
];

export const emptyDraft: StudioDraft = {
  name: 'Selecione um jogador',
  overall: 90,
  position: 'CA',
  teamName: 'Time',
  teamLogoUrl: '',
  collectionName: 'Coleção',
  collectionLogoUrl: '',
  playerImageUrl: '',
  photoFormat: 'missing',
  primaryColor: '#071a32',
  secondaryColor: '#48f5e7',
  photoIsStandard: false,
  style: 'elite',
  finish: 'holo',
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
  pace: 90,
  finishing: 90,
  passing: 90,
  dribbling: 90,
  marking: 90,
  control: 90,
  layerVisibility: defaultLayerVisibility,
  layerLocks: defaultLayerLocks,
  layerOrder: defaultLayerOrder,
};

export const stylePresets: readonly StudioPreset[] = [
  {
    id: 'elite-aqua',
    label: 'Elite Aqua',
    description: 'Escudo ciano, marinho e ouro',
    primaryColor: '#071a32',
    secondaryColor: '#48f5e7',
    style: 'elite',
    finish: 'holo',
    rarity: 'legendary',
  },
  {
    id: 'neon',
    label: 'Neon Azul',
    description: 'Elétrica, fria e precisa',
    primaryColor: '#142a4a',
    secondaryColor: '#70ddff',
    style: 'signature',
    finish: 'foil',
    rarity: 'rare',
  },
  {
    id: 'gold',
    label: 'Gold Icon',
    description: 'Metal quente de coleção',
    primaryColor: '#302510',
    secondaryColor: '#e7bb55',
    style: 'signature',
    finish: 'chrome',
    rarity: 'icon',
  },
  {
    id: 'night',
    label: 'Night Shift',
    description: 'Editorial com brilho violeta',
    primaryColor: '#17142d',
    secondaryColor: '#8f7cff',
    style: 'midnight',
    finish: 'holo',
    rarity: 'epic',
  },
  {
    id: 'fire',
    label: 'Crimson Heat',
    description: 'Energia de jogo decisivo',
    primaryColor: '#360f18',
    secondaryColor: '#ff5d58',
    style: 'velocity',
    finish: 'energy',
    rarity: 'legendary',
  },
  {
    id: 'retro',
    label: 'Retro Broadcast',
    description: 'Placar de TV dos anos 90',
    primaryColor: '#182b2c',
    secondaryColor: '#d6ff5f',
    style: 'velocity',
    finish: 'retro',
    rarity: 'rare',
  },
];

const positionBias: Readonly<Record<string, Partial<Record<StatKey, number>>>> = {
  GOL: { pace: -10, finishing: -15, passing: -2, dribbling: -6, marking: 5, control: 3 },
  LD: { pace: 4, finishing: -7, passing: 2, dribbling: 1, marking: 4, control: 1 },
  LE: { pace: 4, finishing: -7, passing: 2, dribbling: 1, marking: 4, control: 1 },
  ZAG: { pace: -4, finishing: -12, passing: -2, dribbling: -6, marking: 7, control: 1 },
  VOL: { pace: -1, finishing: -5, passing: 3, dribbling: -1, marking: 6, control: 3 },
  MA: { pace: 1, finishing: 2, passing: 5, dribbling: 4, marking: -4, control: 5 },
  MC: { pace: 0, finishing: -1, passing: 6, dribbling: 2, marking: 1, control: 5 },
  PD: { pace: 6, finishing: 3, passing: 1, dribbling: 6, marking: -8, control: 4 },
  PE: { pace: 6, finishing: 3, passing: 1, dribbling: 6, marking: -8, control: 4 },
  CA: { pace: 3, finishing: 7, passing: -2, dribbling: 2, marking: -12, control: 3 },
};

export function statsForPosition(position: string, overall: number): Record<StatKey, number> {
  const bias = positionBias[position] ?? {};
  return Object.fromEntries(
    statFields.map(([key]) => [key, clamp(Math.round(overall + (bias[key] ?? 0)), 1, 100)]),
  ) as Record<StatKey, number>;
}

export function moveLayer(
  order: readonly LayerKey[],
  layer: LayerKey,
  direction: -1 | 1,
): readonly LayerKey[] {
  const currentIndex = order.indexOf(layer);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length) return order;
  const next = [...order];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return next;
}

export function assetExtension(value: string): string {
  if (!value) return '';
  try {
    const path = new URL(value, window.location.origin).pathname;
    return path.split('.').pop()?.toLowerCase() ?? '';
  } catch {
    return value.split(/[?#]/, 1)[0].split('.').pop()?.toLowerCase() ?? '';
  }
}

export function inspectDraft(draft: StudioDraft): readonly InspectorCheck[] {
  const statsReady = statFields.every(
    ([key]) => Number.isInteger(draft[key]) && draft[key] >= 1 && draft[key] <= 100,
  );
  const essentialLayers = ['background', 'photo', 'identity', 'stats'] as const;
  const hiddenEssentials = essentialLayers.filter((layer) => !draft.layerVisibility[layer]);
  const contrast = contrastRatio(draft.primaryColor, draft.secondaryColor);

  return [
    {
      id: 'photo',
      label: 'Foto do jogador',
      detail: draft.photoIsStandard
        ? 'PNG em 1200 × 1200 configurado e pronto para composição.'
        : draft.playerImageUrl
          ? 'Padronize o recorte em PNG 1200 × 1200 antes de exportar.'
          : 'Selecione uma foto compatível para liberar a exportação.',
      status:
        draft.photoIsStandard && draft.photoFormat !== 'missing' && Boolean(draft.playerImageUrl)
          ? 'ready'
          : 'blocked',
      panel: 'photo',
    },
    {
      id: 'shield',
      label: 'Escudo vetorial',
      detail:
        assetExtension(draft.teamLogoUrl) === 'svg'
          ? 'Escudo SVG preserva nitidez em 2×.'
          : 'O time precisa de escudo SVG no Gerenciamento.',
      status: assetExtension(draft.teamLogoUrl) === 'svg' ? 'ready' : 'blocked',
      panel: 'data',
    },
    {
      id: 'name',
      label: 'Área segura do nome',
      detail:
        draft.name.trim().length > 20
          ? 'Nome longo: tipografia reduzida automaticamente.'
          : 'Nome cabe na grade mestre sem redução.',
      status: draft.name.trim().length > 20 ? 'warning' : draft.name.trim() ? 'ready' : 'blocked',
      panel: 'data',
    },
    {
      id: 'stats',
      label: 'Stats completos',
      detail: statsReady
        ? 'Seis atributos dentro do intervalo 1–100.'
        : 'Revise atributos fora do intervalo.',
      status: statsReady ? 'ready' : 'blocked',
      panel: 'data',
    },
    {
      id: 'collection',
      label: 'Coleção definida',
      detail:
        draft.collectionName === 'Coleção'
          ? 'Selecione um card do banco.'
          : `${draft.collectionName} controla paleta e assets.`,
      status: draft.collectionName === 'Coleção' ? 'blocked' : 'ready',
      panel: 'visual',
    },
    {
      id: 'contrast',
      label: 'Separação de paleta',
      detail:
        contrast >= 2
          ? `Contraste visual ${contrast.toFixed(1)}:1 entre cores.`
          : `Contraste ${contrast.toFixed(1)}:1; aumente a distância entre as cores.`,
      status: contrast >= 2 ? 'ready' : 'warning',
      panel: 'visual',
    },
    {
      id: 'layers',
      label: 'Camadas essenciais',
      detail: hiddenEssentials.length
        ? `${hiddenEssentials.length} camada(s) essencial(is) oculta(s).`
        : 'Background, foto, nome e stats visíveis.',
      status: hiddenEssentials.length ? 'warning' : 'ready',
      panel: 'layers',
    },
  ];
}

export function parseStoredDraft(value: unknown): StudioDraft | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const stringKeys = [
    'name',
    'position',
    'teamName',
    'teamLogoUrl',
    'collectionName',
    'collectionLogoUrl',
    'playerImageUrl',
    'primaryColor',
    'secondaryColor',
  ] as const;
  const numberKeys = [
    'overall',
    'photoScale',
    'photoX',
    'photoY',
    'ratingX',
    'ratingY',
    'identityX',
    'identityY',
    'statsX',
    'statsY',
    'pace',
    'finishing',
    'passing',
    'dribbling',
    'marking',
    'control',
  ] as const;
  if (stringKeys.some((key) => typeof candidate[key] !== 'string')) return null;
  if (
    numberKeys.some((key) => typeof candidate[key] !== 'number' || !Number.isFinite(candidate[key]))
  )
    return null;
  if (!['png', 'other', 'missing'].includes(String(candidate.photoFormat))) return null;
  if (!['elite', 'signature', 'midnight', 'velocity'].includes(String(candidate.style)))
    return null;
  if (!['matte', 'foil', 'holo', 'chrome', 'energy', 'retro'].includes(String(candidate.finish)))
    return null;
  if (!['common', 'rare', 'epic', 'legendary', 'icon'].includes(String(candidate.rarity)))
    return null;

  const visibility = candidate.layerVisibility;
  const locks = candidate.layerLocks;
  if (
    typeof visibility !== 'object' ||
    visibility === null ||
    Array.isArray(visibility) ||
    typeof locks !== 'object' ||
    locks === null ||
    Array.isArray(locks) ||
    defaultLayerOrder.some(
      (layer) =>
        typeof (visibility as Record<string, unknown>)[layer] !== 'boolean' ||
        typeof (locks as Record<string, unknown>)[layer] !== 'boolean',
    )
  )
    return null;
  if (!Array.isArray(candidate.layerOrder)) return null;
  const order = candidate.layerOrder;
  if (
    order.length !== defaultLayerOrder.length ||
    order.some((layer, index) => order.indexOf(layer) !== index) ||
    order.some((layer) => !defaultLayerOrder.includes(layer as LayerKey))
  )
    return null;

  const {
    collectionOverlayUrl: _legacyOverlay,
    photoIsStandard,
    ...draft
  } = candidate as Omit<StudioDraft, 'photoIsStandard'> & {
    collectionOverlayUrl?: unknown;
    photoIsStandard?: unknown;
  };
  if (draft.playerImageUrl.startsWith('blob:')) {
    return { ...draft, photoIsStandard: false, playerImageUrl: '', photoFormat: 'missing' };
  }
  return { ...draft, photoIsStandard: photoIsStandard === true };
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(color: string): number {
  const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : '000000';
  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255,
  );
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
