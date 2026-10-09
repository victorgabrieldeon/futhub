import type { PackCatalogItem } from '@futhub/api-client';
import { createCanvas } from '@napi-rs/canvas';
import type { Image, SKRSContext2D } from '@napi-rs/canvas';

import { displayFont, interfaceFont, monoFont } from './image-fonts.js';
import { remoteImage } from './remote-image.js';
import { packTier } from './store-pack-tier.js';
import type { PackTier } from './store-pack-tier.js';

export const packsImageName = 'futhub-packs.png';

type PackTile = PackCatalogItem & { readonly favorite: boolean };
type PacksImage = Readonly<{
  items: readonly PackTile[];
  page: number;
  totalPages: number;
}>;

// Admin dark theme (apps/admin/src/editorial.css + studio.css store preview).
const WIDTH = 1_200;
const HEIGHT = 675;
const CANVAS = '#111111';
const STAGE_RAISED = '#18181b';
const STAGE_LINE = 'rgba(255,255,255,0.09)';
const HAIRLINE_STRONG = '#4b4b4d';
const INK = '#ffffff';
const STAGE_INK = '#f4f4f5';
const BODY = '#cacacb';
const MUTE = '#9e9ea0';
const SUCCESS = '#1eaa52';

const TILE_TOP = 168;
const TILE_WIDTH = 266;
const TILE_HEIGHT = 476;
const TILE_GAP = 18;
const TILE_PADDING = 16;
const ART_SCALE = 0.37;

type Weight = 400 | 500 | 600 | 700;
type Align = 'left' | 'center' | 'right';

function text(
  context: SKRSContext2D,
  value: string,
  x: number,
  y: number,
  font: string,
  fill: string,
  align: Align = 'left',
  tracking = 0,
): number {
  context.font = font;
  context.letterSpacing = `${tracking}px`;
  context.textAlign = align;
  context.textBaseline = 'middle';
  context.fillStyle = fill;
  context.fillText(value, x, y);
  const width = context.measureText(value).width;
  context.letterSpacing = '0px';
  return width;
}

const display = (size: number, weight: Weight = 600) => `${weight} ${size}px ${displayFont}`;
const ui = (size: number, weight: Weight = 400) => `${weight} ${size}px ${interfaceFont}`;
const mono = (size: number, weight: Weight = 500) => `${weight} ${size}px ${monoFont}`;

function crop(context: SKRSContext2D, value: string, maxWidth: number, font: string): string {
  context.font = font;
  if (context.measureText(value).width <= maxWidth) return value;
  let result = value;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth)
    result = result.slice(0, -1);
  return `${result.trim()}…`;
}

function alpha(hex: string, opacity: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

function header(context: SKRSContext2D, page: number, totalPages: number, count: number): void {
  context.fillStyle = CANVAS;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // futhub-monogram: skewed signal block with the condensed "FH".
  context.save();
  context.translate(58, 44);
  context.transform(1, 0, -0.14, 1, 0, 0);
  context.fillStyle = INK;
  context.fillRect(-18, -18, 38, 36);
  context.restore();
  text(context, 'FH', 58, 47, display(30, 700), CANVAS, 'center', -2);
  const brand = text(context, 'FutHub', 90, 44, ui(24, 600), INK, 'left', -1.2);
  context.fillStyle = HAIRLINE_STRONG;
  context.fillRect(104 + brand, 36, 1, 16);
  text(context, 'LOJA', 118 + brand, 45, mono(10), MUTE, 'left', 2);

  context.fillStyle = SUCCESS;
  context.beginPath();
  context.arc(1_160 - 4, 44, 2.5, 0, Math.PI * 2);
  context.fill();
  text(
    context,
    `PÁGINA ${String(page).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`,
    1_160 - 14,
    45,
    mono(10),
    MUTE,
    'right',
    1.5,
  );

  // command-header: condensed title + mono count, body copy aligned to the baseline.
  const title = text(context, 'PACKS', 38, 112, display(62, 600), INK, 'left', -1.2);
  if (count > 0)
    text(context, String(count).padStart(2, '0'), 50 + title, 98, mono(22), MUTE, 'left', 1);
  text(context, 'Escolha um pack, abra e monte seu time.', 1_160, 120, ui(15), BODY, 'right');

  context.fillStyle = HAIRLINE_STRONG;
  context.fillRect(40, 146, 1_120, 1);
}

function roundRect(
  context: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function linear(
  context: SKRSContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: readonly (readonly [number, string])[],
) {
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, value] of stops) gradient.addColorStop(offset, value);
  return gradient;
}

function stroke(context: SKRSContext2D, value: string, width: number): void {
  context.strokeStyle = value;
  context.lineWidth = width;
  context.stroke();
}

function sealRidges(context: SKRSContext2D, top: number, count: number): void {
  for (let index = 0; index < count; index += 1) {
    const y = top + index * 11;
    context.beginPath();
    context.moveTo(50, y);
    context.bezierCurveTo(182, y - 16, 422, y - 8, 550, y + 4);
    stroke(context, 'rgba(255,255,255,0.24)', 1);
  }
}

/** Canvas port of the Pack Studio wrapper (apps/admin/src/features/studio/pack-art.ts). */
function packArt(
  context: SKRSContext2D,
  pack: PackTile,
  tier: PackTier,
  x: number,
  y: number,
): void {
  const { color, accent, effect } = tier;
  const light = 0.21;
  const wrapper = () =>
    linear(context, 20, 12, 580, 788, [
      [0, '#696a7c'],
      [0.14, '#ffffff'],
      [0.3, '#77788b'],
      [0.5, '#f8f7ff'],
      [0.72, '#77788b'],
      [0.88, '#ffffff'],
      [1, '#555666'],
    ]);
  const body = (top: number, bottom: number) =>
    linear(context, 42, top, 558, bottom, [
      [0, '#060b16'],
      [0.2, color],
      [0.5, '#0a1831'],
      [0.78, color],
      [1, '#040811'],
    ]);
  const seal = (top: number, height: number) =>
    linear(context, 0, top, 0, top + height, [
      [0, '#090718'],
      [0.14, color],
      [0.48, alpha(effect, light)],
      [0.74, color],
      [1, '#090718'],
    ]);
  const foil = () =>
    linear(context, 160, 300, 440, 580, [
      [0, accent],
      [0.24, effect],
      [0.48, '#ffffff'],
      [0.72, accent],
      [1, '#676879'],
    ]);

  context.save();
  context.translate(x, y);
  context.scale(ART_SCALE, ART_SCALE);

  context.save();
  context.shadowColor = alpha(accent, 0.35);
  context.shadowBlur = 90;
  context.shadowOffsetY = 30;
  roundRect(context, 20, 12, 560, 776, 36);
  context.fillStyle = wrapper();
  context.fill();
  context.restore();

  roundRect(context, 31, 23, 538, 754, 30);
  context.fillStyle = '#0a0912';
  context.fill();
  stroke(context, 'rgba(255,255,255,0.5)', 2);
  roundRect(context, 42, 34, 516, 732, 26);
  context.fillStyle = body(34, 766);
  context.fill();
  stroke(context, '#8d8da0', 2);
  roundRect(context, 55, 112, 490, 584, 20);
  context.fillStyle = body(112, 696);
  context.fill();
  stroke(context, 'rgba(244,242,255,0.72)', 3);

  context.save();
  roundRect(context, 55, 112, 490, 584, 20);
  context.clip();
  const glow = context.createRadialGradient(300, 416, 0, 300, 416, 278);
  glow.addColorStop(0, alpha(accent, 0.42));
  glow.addColorStop(0.48, alpha(color, 0.2));
  glow.addColorStop(1, 'rgba(5,4,13,0)');
  context.fillStyle = glow;
  context.fillRect(22, 138, 556, 556);
  context.fillStyle = alpha(effect, light);
  context.fillRect(55, 112, 490, 584);
  for (const [rx, ry] of [
    [132, 118],
    [184, 164],
    [230, 205],
  ] as const) {
    context.beginPath();
    context.ellipse(300, 438, rx, ry, 0, 0, Math.PI * 2);
    stroke(context, alpha(accent, 0.084), 2);
  }
  context.beginPath();
  context.moveTo(56, 164);
  context.bezierCurveTo(156, 108, 402, 118, 544, 188);
  stroke(context, 'rgba(255,255,255,0.2)', 15);
  context.beginPath();
  context.moveTo(66, 674);
  context.lineTo(526, 154);
  stroke(context, 'rgba(255,255,255,0.08)', 56);
  context.beginPath();
  context.moveTo(80, 690);
  context.lineTo(540, 170);
  stroke(context, 'rgba(255,255,255,0.17)', 3);
  context.restore();

  roundRect(context, 42, 34, 516, 104, 24);
  context.fillStyle = seal(34, 104);
  context.fill();
  sealRidges(context, 50, 8);
  roundRect(context, 42, 674, 516, 92, 24);
  context.fillStyle = seal(674, 92);
  context.fill();
  sealRidges(context, 687, 7);

  context.globalAlpha = 0.88;
  context.fillStyle = wrapper();
  roundRect(context, 30, 62, 18, 654, 9);
  context.fill();
  roundRect(context, 552, 62, 18, 654, 9);
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = 'rgba(255,255,255,0.42)';
  context.fillRect(50, 152.5, 500, 3);
  context.fillRect(50, 666.5, 500, 3);

  // Smoked viewport with the raised headline.
  roundRect(context, 92, 166, 416, 120, 28);
  context.fillStyle = linear(context, 0, 166, 0, 286, [
    [0, 'rgba(221,236,255,0.22)'],
    [0.12, 'rgba(7,18,43,0.84)'],
    [0.86, 'rgba(2,6,16,0.9)'],
    [1, 'rgba(173,200,255,0.16)'],
  ]);
  context.fill();
  stroke(context, alpha(accent, 0.78), 3);
  roundRect(context, 102, 176, 396, 100, 21);
  stroke(context, 'rgba(255,255,255,0.26)', 2);
  text(context, tier.label, 300, 196, display(24, 700), accent, 'center', 6);
  context.save();
  context.translate(300, 244);
  context.transform(1, 0, -0.18, 1, 0, 0);
  context.shadowColor = 'rgba(0,0,0,0.88)';
  context.shadowOffsetX = 3;
  context.shadowOffsetY = 7;
  context.shadowBlur = 4;
  const headline = `${pack.cardsAmount} ${pack.cardsAmount === 1 ? 'CARTA' : 'CARTAS'}`;
  context.font = display(62, 700);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 6;
  context.strokeStyle = accent;
  context.strokeText(headline, 0, 0);
  context.shadowColor = 'transparent';
  context.fillStyle = linear(context, 0, -30, 0, 30, [
    [0, '#ffffff'],
    [0.32, '#ffffff'],
    [1, 'rgba(255,255,255,0.55)'],
  ]);
  context.fillText(headline, 0, 0);
  context.restore();

  // Ball emblem.
  context.beginPath();
  context.arc(300, 448, 144, 0, Math.PI * 2);
  context.fillStyle = 'rgba(4,5,15,0.52)';
  context.fill();
  context.beginPath();
  context.arc(300, 436, 139, 0, Math.PI * 2);
  context.fillStyle = '#fbfbff';
  context.fill();
  context.strokeStyle = foil();
  context.lineWidth = 12;
  context.stroke();
  context.beginPath();
  context.arc(300, 436, 124, 0, Math.PI * 2);
  context.fillStyle = linear(context, 0, 312, 0, 560, [
    [0, 'rgba(255,255,255,0.2)'],
    [0.45, alpha(color, 0.54)],
    [1, 'rgba(7,6,17,0.96)'],
  ]);
  context.fill();
  stroke(context, 'rgba(255,255,255,0.52)', 3);
  const patches = [
    [300, 364, 338, 392, 324, 437, 276, 437, 262, 392],
    [198, 403, 236, 375, 270, 399, 260, 441, 216, 455, 185, 430],
    [402, 403, 364, 375, 330, 399, 340, 441, 384, 455, 415, 430],
    [222, 507, 262, 469, 300, 489, 300, 537, 264, 561, 221, 544],
    [378, 507, 338, 469, 300, 489, 300, 537, 336, 561, 379, 544],
  ];
  for (const points of patches) {
    context.beginPath();
    for (let index = 0; index < points.length; index += 2)
      context.lineTo(points[index] ?? 0, points[index + 1] ?? 0);
    context.closePath();
    context.fillStyle = color;
    context.fill();
    stroke(context, 'rgba(255,255,255,0.72)', 4);
  }
  context.lineCap = 'round';
  for (const [x0, y0, x1, y1] of [
    [262, 437, 224, 507],
    [338, 437, 378, 507],
    [216, 455, 222, 507],
    [384, 455, 378, 507],
    [236, 375, 198, 403],
    [364, 375, 402, 403],
  ] as const) {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    stroke(context, 'rgba(255,255,255,0.62)', 5);
  }
  context.lineCap = 'butt';
  context.beginPath();
  context.ellipse(256, 384, 54, 22, -Math.PI / 6, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255,255,255,0.4)';
  context.fill();

  context.save();
  context.translate(300, 618);
  context.transform(1, 0, -0.18, 1, 0, 0);
  context.font = display(64, 700);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = linear(context, -40, -30, 40, 30, [
    [0, accent],
    [0.5, '#ffffff'],
    [1, accent],
  ]);
  context.fillText('FH', 0, 0);
  context.restore();
  text(context, 'FUTHUB', 300, 652, display(22, 600), '#ffffff', 'center', 6);

  context.restore();
}

/** Published Pack Studio art (600 × 800, transparent) fitted into the same box as the fallback. */
function uploadedArt(
  context: SKRSContext2D,
  image: Image,
  tier: PackTier,
  x: number,
  y: number,
): void {
  const boxWidth = 600 * ART_SCALE;
  const boxHeight = 800 * ART_SCALE;
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.save();
  context.shadowColor = alpha(tier.accent, 0.3);
  context.shadowBlur = 28;
  context.shadowOffsetY = 10;
  context.drawImage(image, x + (boxWidth - width) / 2, y + (boxHeight - height) / 2, width, height);
  context.restore();
}

function tile(context: SKRSContext2D, pack: PackTile, x: number, image: Image | undefined): void {
  const tier = packTier(pack.price);
  const inner = TILE_WIDTH - TILE_PADDING * 2;
  const left = x + TILE_PADDING;

  roundRect(context, x, TILE_TOP, TILE_WIDTH, TILE_HEIGHT, 16);
  context.fillStyle = STAGE_RAISED;
  context.fill();
  stroke(context, STAGE_LINE, 1);

  const artX = x + (TILE_WIDTH - 600 * ART_SCALE) / 2;
  if (image) uploadedArt(context, image, tier, artX, TILE_TOP + 14);
  else packArt(context, pack, tier, artX, TILE_TOP + 14);
  if (pack.favorite) {
    roundRect(context, left - 4, TILE_TOP + 12, 78, 22, 11);
    context.fillStyle = STAGE_INK;
    context.fill();
    text(context, 'FAVORITO', left + 35, TILE_TOP + 23.5, mono(9, 600), CANVAS, 'center', 1);
  }

  const detailsTop = TILE_TOP + 316;
  context.fillStyle = tier.accent;
  context.fillRect(left, detailsTop - 2.5, 5, 5);
  text(
    context,
    `PACK DE CARTAS · ${tier.label}`,
    left + 12,
    detailsTop,
    mono(10),
    MUTE,
    'left',
    1.2,
  );
  const nameFont = display(30, 600);
  text(
    context,
    crop(context, pack.name.toUpperCase(), inner, nameFont),
    left,
    detailsTop + 32,
    nameFont,
    STAGE_INK,
  );
  text(
    context,
    `${pack.cardsAmount} ${pack.cardsAmount === 1 ? 'carta' : 'cartas'} · limite ${pack.limitPerUser} por jogador`,
    left,
    detailsTop + 62,
    ui(12),
    '#a1a1aa',
  );

  context.fillStyle = STAGE_LINE;
  context.fillRect(left, detailsTop + 84, inner, 1);
  context.font = ui(14, 600);
  const price = `${pack.price.toLocaleString('pt-BR')} moedas`;
  const pillWidth = context.measureText(price).width + 24;
  roundRect(context, left, detailsTop + 100, pillWidth, 30, 15);
  context.fillStyle = STAGE_INK;
  context.fill();
  text(context, price, left + 12, detailsTop + 115.5, ui(14, 600), '#111113');
  text(context, 'VER NO MENU ↓', left + inner, detailsTop + 115.5, mono(9), MUTE, 'right', 1);
}

function empty(context: SKRSContext2D): void {
  roundRect(context, 40, TILE_TOP, 1_120, TILE_HEIGHT, 16);
  context.fillStyle = STAGE_RAISED;
  context.fill();
  stroke(context, STAGE_LINE, 1);
  text(context, 'VITRINE VAZIA', 600, 352, mono(11), MUTE, 'center', 2);
  text(context, 'NOVOS PACKS EM BREVE', 600, 410, display(72, 600), INK, 'center', -1.4);
  text(context, 'Volte mais tarde para conferir os lançamentos.', 600, 476, ui(15), BODY, 'center');
}

export async function renderPacksImage({ items, page, totalPages }: PacksImage): Promise<Buffer> {
  const packs = items.slice(0, 4);
  const images = await Promise.all(
    packs.map((pack) => (pack.imageUrl ? remoteImage(pack.imageUrl) : undefined)),
  );
  const canvas = createCanvas(WIDTH, HEIGHT);
  const context = canvas.getContext('2d');
  header(context, page, totalPages, packs.length);

  const rowWidth = packs.length * TILE_WIDTH + (packs.length - 1) * TILE_GAP;
  const start = (WIDTH - rowWidth) / 2;
  if (packs.length === 0) empty(context);
  else
    packs.forEach((pack, index) =>
      tile(context, pack, start + index * (TILE_WIDTH + TILE_GAP), images[index]),
    );

  return canvas.toBuffer('image/png');
}
