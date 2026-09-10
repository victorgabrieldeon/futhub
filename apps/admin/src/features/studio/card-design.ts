export const cardFrames = [
  { id: 'crest', label: 'Brasão', detail: 'Coroa e ponta esculpida' },
  { id: 'arena', label: 'Arena', detail: 'Ombros largos e arco' },
  { id: 'ticket', label: 'Ingresso', detail: 'Recortes de edição especial' },
  { id: 'diamond', label: 'Diamante', detail: 'Facetas altas e corte preciso' },
  { id: 'hexagon', label: 'Hexágono', detail: 'Laterais firmes de edição tática' },
  { id: 'crown', label: 'Coroa', detail: 'Topo real para cards de elite' },
  { id: 'wing', label: 'Asa', detail: 'Linhas abertas de velocidade' },
  { id: 'pavilion', label: 'Pavilhão', detail: 'Arquitetura clássica de estádio' },
] as const;

export const cardFramePaths = {
  crest:
    'M72 56H226L248 24H352L374 56H528L570 98V618Q570 706 492 754L300 792 108 754Q30 706 30 618V98Z',
  arena: 'M68 42H532L574 104V646Q574 718 504 746L300 788 96 746Q26 718 26 646V104Z',
  ticket:
    'M74 32H526Q566 32 566 72V212Q542 212 542 236Q542 260 566 260V694Q566 738 524 754L300 784 76 754Q34 738 34 694V260Q58 260 58 236Q58 212 34 212V72Q34 32 74 32Z',
  diamond: 'M126 28H474L568 122V654Q568 720 490 758L300 794 110 758Q32 720 32 654V122Z',
  hexagon: 'M132 24H468L574 130V670L468 776H132L26 670V130Z',
  crown:
    'M32 104 96 38 168 92 232 28H368L432 92 504 38 568 104V650Q568 718 490 756L300 792 110 756Q32 718 32 650Z',
  wing: 'M42 112 132 36H222L252 74H348L378 36H468L558 112V660L478 764H122L42 660Z',
  pavilion: 'M70 34H530L570 84V652L506 726 300 790 94 726 30 652V84Z',
} as const;

export type CardDesign = Readonly<{
  frame: keyof typeof cardFramePaths;
  texture: 'diamond' | 'rays' | 'none';
  metalColor: string;
  frameWidth: number;
  textureOpacity: number;
  glow: number;
  nameScale: number;
  typography: 'sport' | 'classic';
  photoBrightness: number;
  photoSaturation: number;
  edition: string;
  showNameplate: boolean;
  showStatBars: boolean;
}>;

export const defaultCardDesign: CardDesign = {
  frame: 'crest',
  texture: 'diamond',
  metalColor: '#d9bc78',
  frameWidth: 8,
  textureOpacity: 45,
  glow: 35,
  nameScale: 100,
  typography: 'sport',
  photoBrightness: 100,
  photoSaturation: 100,
  edition: 'EDIÇÃO ESPECIAL',
  showNameplate: true,
  showStatBars: true,
};

export function parseCardDesign(value: unknown): CardDesign | null {
  if (value === undefined) return defaultCardDesign;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  if (
    !('frame' in value) ||
    !('texture' in value) ||
    !('metalColor' in value) ||
    !('frameWidth' in value) ||
    !('textureOpacity' in value) ||
    !('glow' in value) ||
    !('nameScale' in value) ||
    !('typography' in value) ||
    !('photoBrightness' in value) ||
    !('photoSaturation' in value) ||
    !('edition' in value) ||
    !('showNameplate' in value) ||
    !('showStatBars' in value)
  )
    return null;
  const {
    frame,
    texture,
    metalColor,
    frameWidth,
    textureOpacity,
    glow,
    nameScale,
    typography,
    photoBrightness,
    photoSaturation,
    edition,
    showNameplate,
    showStatBars,
  } = value;
  if (!isCardFrame(frame)) return null;
  if (texture !== 'diamond' && texture !== 'rays' && texture !== 'none') return null;
  if (typography !== 'sport' && typography !== 'classic') return null;
  if (typeof metalColor !== 'string' || !/^#[\da-f]{6}$/i.test(metalColor)) return null;
  if (
    !inRange(frameWidth, 4, 12) ||
    !inRange(textureOpacity, 0, 100) ||
    !inRange(glow, 0, 100) ||
    !inRange(nameScale, 70, 115) ||
    !inRange(photoBrightness, 50, 150) ||
    !inRange(photoSaturation, 0, 150)
  )
    return null;
  if (
    typeof edition !== 'string' ||
    edition.length > 32 ||
    typeof showNameplate !== 'boolean' ||
    typeof showStatBars !== 'boolean'
  )
    return null;
  return {
    frame,
    texture,
    metalColor,
    frameWidth,
    textureOpacity,
    glow,
    nameScale,
    typography,
    photoBrightness,
    photoSaturation,
    edition,
    showNameplate,
    showStatBars,
  };
}

function isCardFrame(value: unknown): value is keyof typeof cardFramePaths {
  return typeof value === 'string' && Object.hasOwn(cardFramePaths, value);
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
