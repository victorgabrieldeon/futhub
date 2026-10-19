import type { PackCatalogItem } from '@futhub/api-client';
import type { Image } from '@napi-rs/canvas';

import { fmt, twoDigits } from '../core/format.js';
import { packTier } from '../features/store/store-pack-tier.js';
import type { PackTier } from '../features/store/store-pack-tier.js';
import {
  type Ctx,
  INK,
  type Icon,
  W,
  alpha,
  backdrop,
  box,
  canvas,
  crop,
  display,
  eyebrow,
  glow,
  gradient,
  masthead,
  mono,
  pill,
  png,
  raised,
  ui,
  write,
} from './kit.js';
import { coinsIcon, pack as sealedPack, star } from './props.js';
import { remoteImage } from './remote-image.js';

export const packsImageName = 'futhub-packs.png';

type PackTile = PackCatalogItem & { readonly favorite: boolean };
type PacksImage = Readonly<{
  items: readonly PackTile[];
  page: number;
  totalPages: number;
}>;

/**
 * Vitrine de packs da /loja: noite de estádio do FutHub, um painel por pack com a arte, o nome,
 * as cartas e o preço em dourado. A arte do pack segue a do Pack Studio.
 */
const NEON = INK.success;
const GOLD = INK.gold;
const MARGIN = 34;
const TILE_TOP = 176;
const TILE_HEIGHT = 466;
const TILE_GAP = 16;
const TILE_WIDTH = (W - MARGIN * 2 - TILE_GAP * 3) / 4;
const TILE_PADDING = 18;
const ART_SCALE = 0.35;
const ART_TOP = 16;

function stroke(context: Ctx, value: string, width: number): void {
  context.strokeStyle = value;
  context.lineWidth = width;
  context.stroke();
}

function sealRidges(context: Ctx, top: number, count: number): void {
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
  context: Ctx,
  pack: Readonly<{ cardsAmount: number }>,
  tier: PackTier,
  x: number,
  y: number,
  size: number,
): void {
  const { color, accent, effect } = tier;
  const light = 0.21;
  const wrapper = () =>
    gradient(context, 20, 12, 580, 788, [
      [0, '#696a7c'],
      [0.14, '#ffffff'],
      [0.3, '#77788b'],
      [0.5, '#f8f7ff'],
      [0.72, '#77788b'],
      [0.88, '#ffffff'],
      [1, '#555666'],
    ]);
  const body = (top: number, bottom: number) =>
    gradient(context, 42, top, 558, bottom, [
      [0, '#060b16'],
      [0.2, color],
      [0.5, '#0a1831'],
      [0.78, color],
      [1, '#040811'],
    ]);
  const seal = (top: number, height: number) =>
    gradient(context, 0, top, 0, top + height, [
      [0, '#090718'],
      [0.14, color],
      [0.48, alpha(effect, light)],
      [0.74, color],
      [1, '#090718'],
    ]);
  const foil = () =>
    gradient(context, 160, 300, 440, 580, [
      [0, accent],
      [0.24, effect],
      [0.48, '#ffffff'],
      [0.72, accent],
      [1, '#676879'],
    ]);

  context.save();
  context.translate(x, y);
  context.scale(size, size);

  context.save();
  context.shadowColor = alpha(accent, 0.35);
  context.shadowBlur = 90;
  context.shadowOffsetY = 30;
  box(context, 20, 12, 560, 776, 36);
  context.fillStyle = wrapper();
  context.fill();
  context.restore();

  box(context, 31, 23, 538, 754, 30);
  context.fillStyle = '#0a0912';
  context.fill();
  stroke(context, 'rgba(255,255,255,0.5)', 2);
  box(context, 42, 34, 516, 732, 26);
  context.fillStyle = body(34, 766);
  context.fill();
  stroke(context, '#8d8da0', 2);
  box(context, 55, 112, 490, 584, 20);
  context.fillStyle = body(112, 696);
  context.fill();
  stroke(context, 'rgba(244,242,255,0.72)', 3);

  context.save();
  box(context, 55, 112, 490, 584, 20);
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

  box(context, 42, 34, 516, 104, 24);
  context.fillStyle = seal(34, 104);
  context.fill();
  sealRidges(context, 50, 8);
  box(context, 42, 674, 516, 92, 24);
  context.fillStyle = seal(674, 92);
  context.fill();
  sealRidges(context, 687, 7);

  context.globalAlpha = 0.88;
  context.fillStyle = wrapper();
  box(context, 30, 62, 18, 654, 9);
  context.fill();
  box(context, 552, 62, 18, 654, 9);
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = 'rgba(255,255,255,0.42)';
  context.fillRect(50, 152.5, 500, 3);
  context.fillRect(50, 666.5, 500, 3);

  // Smoked viewport with the raised headline.
  box(context, 92, 166, 416, 120, 28);
  context.fillStyle = gradient(context, 0, 166, 0, 286, [
    [0, 'rgba(221,236,255,0.22)'],
    [0.12, 'rgba(7,18,43,0.84)'],
    [0.86, 'rgba(2,6,16,0.9)'],
    [1, 'rgba(173,200,255,0.16)'],
  ]);
  context.fill();
  stroke(context, alpha(accent, 0.78), 3);
  box(context, 102, 176, 396, 100, 21);
  stroke(context, 'rgba(255,255,255,0.26)', 2);
  write(context, tier.label, 300, 196, display(24, 700), accent, 'center', 6);
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
  context.fillStyle = gradient(context, 0, -30, 0, 30, [
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
  context.fillStyle = gradient(context, 0, 312, 0, 560, [
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
  context.fillStyle = gradient(context, -40, -30, 40, 30, [
    [0, accent],
    [0.5, '#ffffff'],
    [1, accent],
  ]);
  context.fillText('FH', 0, 0);
  context.restore();
  write(context, 'FUTHUB', 300, 652, display(22, 600), '#ffffff', 'center', 6);

  context.restore();
}

/** Published Pack Studio art (600 × 800, transparent) fitted into the same box as the fallback. */
function uploadedArt(
  context: Ctx,
  image: Image,
  tier: PackTier,
  x: number,
  y: number,
  size: number,
): void {
  const boxWidth = 600 * size;
  const boxHeight = 800 * size;
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

/** Seta para baixo: o menu de packs fica logo abaixo da imagem. */
function down(context: Ctx, x: number, y: number, color: string): void {
  context.beginPath();
  context.moveTo(x - 5, y - 2.5);
  context.lineTo(x, y + 2.5);
  context.lineTo(x + 5, y - 2.5);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke();
  context.lineCap = 'butt';
  context.lineJoin = 'miter';
}

/** Sacola de compras, ícone da seção. */
const bag: Icon = (context, x, y, color) => {
  box(context, x - 7, y - 3, 14, 12, 2.5);
  context.fillStyle = color;
  context.fill();
  context.beginPath();
  context.arc(x, y - 3, 4, Math.PI, 0);
  context.strokeStyle = color;
  context.lineWidth = 1.8;
  context.stroke();
};

function tracked(context: Ctx, value: string, font: string, tracking: number): number {
  context.font = font;
  context.letterSpacing = `${tracking}px`;
  const width = context.measureText(value).width;
  context.letterSpacing = '0px';
  return width;
}

/** Selo da página com um ponto por página quando cabem. */
function pagination(context: Ctx, page: number, totalPages: number): void {
  const label = `PÁGINA ${twoDigits(page)} / ${twoDigits(totalPages)}`;
  const dots = totalPages > 1 && totalPages <= 8 ? totalPages : 0;
  const x = pill(context, label, dots ? (dots - 1) * 11 + 18 : 0, NEON);
  if (!dots) return;
  const start = x + 34 + tracked(context, label, mono(12, 600), 1.5) + 14;
  for (let index = 0; index < dots; index += 1) {
    const current = index === page - 1;
    context.beginPath();
    context.arc(start + index * 11, 46, current ? 3.2 : 2.4, 0, Math.PI * 2);
    context.fillStyle = current ? NEON : 'rgba(255,255,255,0.22)';
    context.fill();
  }
}

function header(context: Ctx, page: number, totalPages: number, count: number): void {
  backdrop(context);
  masthead(context, 'Loja', undefined, NEON, bag);
  pagination(context, page, totalPages);
  eyebrow(context, 'Vitrine', MARGIN + 2, 100);
  const title = write(context, 'PACKS', MARGIN, 138, display(66, 700), INK.white, 'left', -0.5);
  if (count === 0) return;
  write(context, twoDigits(count), MARGIN + title + 12, 120, mono(18, 600), GOLD, 'left', 1);
  down(context, W - MARGIN - 6, 146, NEON);
  write(context, 'Escolha um pack no menu abaixo', W - MARGIN - 22, 146, ui(15), INK.body, 'right');
}

/** Nome em condensada: encolhe até 24 px e só então corta. */
function name(context: Ctx, value: string, x: number, y: number, maxWidth: number): void {
  let size = 32;
  while (size > 24 && tracked(context, value, display(size, 700), 0) > maxWidth) size -= 1;
  const font = display(size, 700);
  write(context, crop(context, value, maxWidth, font), x, y, font, INK.white);
}

function favorite(context: Ctx, x: number, y: number): void {
  const font = mono(10, 700);
  const width = tracked(context, 'FAVORITO', font, 1.5) + 36;
  context.save();
  context.shadowColor = alpha(GOLD, 0.45);
  context.shadowBlur = 14;
  box(context, x, y, width, 26, 8);
  context.fillStyle = gradient(context, x, y, x + width, y + 26, [
    [0, '#ffd56a'],
    [1, GOLD],
  ]);
  context.fill();
  context.restore();
  star(context, x + 15, y + 13, 6.5, INK.canvas);
  write(context, 'FAVORITO', x + 26, y + 14, font, INK.canvas, 'left', 1.5);
}

/** Faixa de preço em dourado; a seta à direita aponta para o menu sob a imagem. */
function price(context: Ctx, value: number, x: number, y: number, w: number, h: number): void {
  box(context, x, y, w, h, 10);
  context.fillStyle = gradient(context, x, y, x + w, y + h, [
    [0, alpha(GOLD, 0.18)],
    [1, alpha(GOLD, 0.04)],
  ]);
  context.fill();
  context.strokeStyle = alpha(GOLD, 0.45);
  context.lineWidth = 1.2;
  context.stroke();

  const middle = y + h / 2;
  coinsIcon(context, x + 22, middle, GOLD);
  const amount = write(context, fmt(value), x + 40, middle + 1, display(28, 700), GOLD);
  write(context, 'moedas', x + 46 + amount, middle + 3, ui(13, 500), INK.body);
  context.fillStyle = alpha(GOLD, 0.3);
  context.fillRect(x + w - h, y + 10, 1, h - 20);
  down(context, x + w - h / 2, middle + 1, INK.white);
}

function tile(context: Ctx, item: PackTile, x: number, image: Image | undefined): void {
  const tier = packTier(item.price);
  const top = TILE_TOP;
  const inner = TILE_WIDTH - TILE_PADDING * 2;
  const left = x + TILE_PADDING;
  const artWidth = 600 * ART_SCALE;
  const artHeight = 800 * ART_SCALE;
  const artX = x + (TILE_WIDTH - artWidth) / 2;
  const artY = top + ART_TOP;

  raised(context, x, top, TILE_WIDTH, TILE_HEIGHT, item.favorite ? GOLD : undefined);
  // Palco: luz na cor da raridade atrás da arte e chão iluminado sob o pack.
  context.save();
  box(context, x, top, TILE_WIDTH, TILE_HEIGHT, 14);
  context.clip();
  glow(context, x + TILE_WIDTH / 2, artY + artHeight * 0.42, TILE_WIDTH * 0.72, tier.accent, 0.2);
  const floor = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  floor.addColorStop(0, alpha(tier.accent, 0.32));
  floor.addColorStop(1, alpha(tier.accent, 0));
  context.translate(x + TILE_WIDTH / 2, artY + artHeight - 6);
  context.scale(artWidth * 0.62, 18);
  context.fillStyle = floor;
  context.fillRect(-1, -1, 2, 2);
  context.restore();

  if (image) uploadedArt(context, image, tier, artX, artY, ART_SCALE);
  else packArt(context, item, tier, artX, artY, ART_SCALE);
  if (item.favorite) favorite(context, x + 12, top + 12);

  const label = artY + artHeight + 24;
  const tag = tracked(context, tier.label, mono(10, 700), 1.5) + 18;
  box(context, left, label - 11, tag, 22, 6);
  context.fillStyle = alpha(tier.accent, 0.12);
  context.fill();
  context.strokeStyle = alpha(tier.accent, 0.5);
  context.lineWidth = 1;
  context.stroke();
  write(context, tier.label, left + 9, label + 1, mono(10, 700), tier.accent, 'left', 1.5);
  write(
    context,
    'PACK DE CARTAS',
    left + tag + 10,
    label + 1,
    mono(10, 500),
    INK.mute,
    'left',
    1.5,
  );

  name(context, item.name.toUpperCase(), left, label + 34, inner);
  const caption = `${item.cardsAmount} ${item.cardsAmount === 1 ? 'carta' : 'cartas'} · limite ${item.limitPerUser} por jogador`;
  write(context, crop(context, caption, inner, ui(13)), left, label + 65, ui(13), INK.body);

  price(context, item.price, left, label + 86, inner, 46);
}

function empty(context: Ctx): void {
  const w = W - MARGIN * 2;
  const cx = W / 2;
  raised(context, MARGIN, TILE_TOP, w, TILE_HEIGHT);
  context.save();
  box(context, MARGIN, TILE_TOP, w, TILE_HEIGHT, 14);
  context.clip();
  glow(context, cx, TILE_TOP + 166, 300, GOLD, 0.14);
  sealedPack(context, cx - 92, TILE_TOP + 176, 78, 112, false);
  sealedPack(context, cx + 92, TILE_TOP + 176, 78, 112, false);
  sealedPack(context, cx, TILE_TOP + 162, 100, 144, true);
  context.restore();
  eyebrow(context, 'Vitrine vazia', cx, TILE_TOP + 286, NEON, 'center');
  write(context, 'NOVOS PACKS EM BREVE', cx, TILE_TOP + 336, display(66, 700), INK.white, 'center');
  write(
    context,
    'Volte mais tarde para conferir os lançamentos.',
    cx,
    TILE_TOP + 390,
    ui(16),
    INK.body,
    'center',
  );
}

export async function renderPacksImage({ items, page, totalPages }: PacksImage): Promise<Buffer> {
  const packs = items.slice(0, 4);
  const images = await Promise.all(
    packs.map((item) => (item.imageUrl ? remoteImage(item.imageUrl) : undefined)),
  );
  const { canvas: target, context } = canvas();
  header(context, page, totalPages, packs.length);

  const rowWidth = packs.length * TILE_WIDTH + (packs.length - 1) * TILE_GAP;
  const start = (W - rowWidth) / 2;
  if (packs.length === 0) empty(context);
  else
    packs.forEach((item, index) =>
      tile(context, item, start + index * (TILE_WIDTH + TILE_GAP), images[index]),
    );

  return png(target);
}

/** Arte do pack (publicada no Pack Studio ou a de fallback), 600 × 800 escalada por `scale`. */
export function drawPackArt(
  context: Ctx,
  pack: Readonly<{ cardsAmount: number; price: number }>,
  image: Image | undefined,
  x: number,
  y: number,
  scale: number,
): void {
  const tier = packTier(pack.price);
  if (image) uploadedArt(context, image, tier, x, y, scale);
  else packArt(context, pack, tier, x, y, scale);
}
