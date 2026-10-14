import type {
  CanvasImage,
  Definition,
  ImageLayer,
  ItemLayer,
  ListLayer,
  RectLayer,
  TextLayer,
} from './types.js';

export const rect = (patch: Partial<RectLayer> = {}): RectLayer => ({
  type: 'rect',
  x: 0,
  y: 0,
  w: 200,
  h: 120,
  fill: '#242424',
  fill2: '',
  radius: 16,
  stroke: '',
  strokeWidth: 0,
  opacity: 1,
  progress: '',
  ...patch,
});

export const label = (patch: Partial<TextLayer> = {}): TextLayer => ({
  type: 'text',
  x: 0,
  y: 0,
  w: 400,
  text: 'Texto',
  size: 32,
  weight: 800,
  color: '#F5F5F5',
  align: 'left',
  uppercase: false,
  lines: 1,
  opacity: 1,
  ...patch,
});

export const picture = (patch: Partial<ImageLayer> = {}): ImageLayer => ({
  type: 'image',
  x: 0,
  y: 0,
  w: 160,
  h: 160,
  url: '{avatarUrl}',
  fit: 'cover',
  radius: 80,
  opacity: 1,
  ...patch,
});

export const grid = (
  source: string,
  layers: ItemLayer[],
  patch: Partial<ListLayer> = {},
): ListLayer => ({
  type: 'list',
  source,
  x: 40,
  y: 160,
  columns: 3,
  cellWidth: 360,
  cellHeight: 140,
  gapX: 20,
  gapY: 20,
  limit: 6,
  layers,
  ...patch,
});

export type ImagePreset = { id: string; label: string; description: string; image: CanvasImage };

const has = (definition: Definition, token: string) =>
  definition.variables.some((variable) => variable.token === `{${token}}`);

function header(title: string, subtitle: string): (TextLayer | RectLayer)[] {
  return [
    rect({ x: 40, y: 36, w: 120, h: 34, fill: '#F5F5F5', radius: 6 }),
    label({ x: 40, y: 44, w: 120, text: 'FUTHUB', size: 16, color: '#111111', align: 'center' }),
    label({ x: 40, y: 88, w: 820, text: title, size: 46, uppercase: true }),
    label({
      x: 760,
      y: 44,
      w: 400,
      text: subtitle,
      size: 16,
      weight: 600,
      color: '#9E9EA0',
      align: 'right',
    }),
    rect({ x: 40, y: 150, w: 1120, h: 3, fill: '#F5F5F5', radius: 0 }),
  ];
}

function listPreset(definition: Definition, source: string): ImagePreset | null {
  const list = definition.lists.find((entry) => entry.name === source);
  if (!list) return null;
  if (source === 'cards')
    return {
      id: 'cards-grid',
      label: 'Grade de cartas',
      description: 'Cartas recebidas em formato de carta colecionável.',
      image: {
        id: 'cartas',
        width: 1200,
        height: 640,
        background: '#111111',
        layers: [
          ...header('Pack aberto', '{cards|count} cartas · nível {level}'),
          grid(
            'cards',
            [
              rect({ w: 200, h: 420, fill: '#D9A21B', fill2: '#5A3A05', radius: 22 }),
              rect({
                x: 10,
                y: 10,
                w: 180,
                h: 400,
                fill: '',
                stroke: '#FFE7A3',
                strokeWidth: 3,
                radius: 16,
              }),
              label({ x: 24, y: 28, w: 100, text: '{overall}', size: 64, color: '#FFF8E1' }),
              label({
                x: 26,
                y: 100,
                w: 100,
                text: '{position}',
                size: 24,
                weight: 600,
                color: '#FFE7A3',
              }),
              rect({ x: 20, y: 300, w: 160, h: 2, fill: '#FFE7A3', radius: 0, opacity: 0.6 }),
              label({
                x: 16,
                y: 318,
                w: 168,
                text: '{name}',
                size: 22,
                align: 'center',
                lines: 2,
                color: '#FFF8E1',
              }),
            ],
            { y: 190, columns: 5, cellWidth: 200, cellHeight: 420, gapX: 30, limit: 5 },
          ),
        ],
      },
    };
  if (source === 'missions')
    return {
      id: 'missions-board',
      label: 'Quadro de missões',
      description: 'Uma linha por missão com barra de progresso.',
      image: {
        id: 'missoes',
        width: 1200,
        height: 720,
        background: '#111111',
        layers: [
          ...header('Missões', '{userName}'),
          grid(
            'missions',
            [
              rect({ w: 1120, h: 92, fill: '#1C1C1E', radius: 14 }),
              label({
                x: 24,
                y: 16,
                w: 160,
                text: '{cadence}',
                size: 16,
                weight: 600,
                color: '#9E9EA0',
                uppercase: true,
              }),
              label({ x: 24, y: 42, w: 720, text: '{title}', size: 28 }),
              label({ x: 780, y: 16, w: 316, text: '{progress}/{goal}', size: 26, align: 'right' }),
              rect({ x: 836, y: 58, w: 260, h: 12, fill: '#2E2E32', radius: 6 }),
              rect({
                x: 836,
                y: 58,
                w: 260,
                h: 12,
                fill: '#55E8FF',
                fill2: '#0D7BD8',
                radius: 6,
                progress: '{percent}',
              }),
            ],
            { y: 180, columns: 1, cellWidth: 1120, cellHeight: 92, gapY: 14, limit: 5 },
          ),
        ],
      },
    };
  const fields = list.fields.slice(0, 2).map((field) => `{${field.name}}`);
  return {
    id: `${source}-grid`,
    label: `Grade: ${list.description}`,
    description: 'Cada item vira um bloco da grade.',
    image: {
      id:
        source
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .slice(0, 32) || 'lista',
      width: 1200,
      height: 520,
      background: '#111111',
      layers: [
        ...header(list.description, '{userName}'),
        grid(source, [
          rect({ w: 360, h: 140, fill: '#1C1C1E' }),
          label({ x: 24, y: 28, w: 312, text: fields[0] ?? '{index}', size: 26 }),
          label({ x: 24, y: 76, w: 312, text: fields[1] ?? '', size: 34, color: '#55E8FF' }),
        ]),
      ],
    },
  };
}

/** Starting designs tailored to the variables and lists of a response. */
export function imagePresets(definition: Definition): ImagePreset[] {
  const presets: ImagePreset[] = [
    {
      id: 'banner',
      label: 'Banner com avatar',
      description: 'Faixa larga com avatar, nome e destaque.',
      image: {
        id: 'banner',
        width: 1200,
        height: 400,
        background: '#0B1220',
        layers: [
          rect({ w: 1200, h: 400, fill: '#0D7BD8', fill2: '#04163A', radius: 0 }),
          rect({ x: 820, y: -120, w: 520, h: 520, fill: '#55E8FF', radius: 260, opacity: 0.12 }),
          picture({ x: 64, y: 100, w: 200, h: 200, radius: 100 }),
          label({ x: 300, y: 110, w: 820, text: '{userName}', size: 64, uppercase: true }),
          label({
            x: 302,
            y: 196,
            w: 820,
            text: has(definition, 'balance')
              ? 'Saldo {balance|number}'
              : has(definition, 'level')
                ? 'Nível {level}'
                : definition.label,
            size: 34,
            weight: 600,
            color: '#55E8FF',
          }),
        ],
      },
    },
  ];
  for (const list of definition.lists) {
    const preset = listPreset(definition, list.name);
    if (preset) presets.push(preset);
  }
  return presets;
}
