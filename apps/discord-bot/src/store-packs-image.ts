import type { PackCatalogItem } from '@futhub/api-client';
import { createCanvas } from '@napi-rs/canvas';
import type { SKRSContext2D } from '@napi-rs/canvas';

import { imageFont } from './image-fonts.js';
import { packTier } from './store-pack-tier.js';

export const packsImageName = 'futhub-packs.png';

type PackTile = PackCatalogItem & { readonly favorite: boolean };
type PacksImage = Readonly<{
  items: readonly PackTile[];
  page: number;
  totalPages: number;
}>;

const WIDTH = 1_200;
const HEIGHT = 675;
const BACKGROUND = '#111111';
const INK = '#f5f5f5';
const WHITE = '#ffffff';
const CLOUD = '#242424';
const MUTE = '#9e9ea0';
const HAIRLINE = '#4b4b4d';

function color(value: readonly number[], alpha = 1): string {
  return `rgba(${value[0]}, ${value[1]}, ${value[2]}, ${alpha})`;
}

function text(
  context: SKRSContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  fill = INK,
  align: 'left' | 'center' | 'right' = 'left',
  weight = 700,
): void {
  context.font = `${weight} ${size}px ${imageFont}`;
  context.textAlign = align;
  context.textBaseline = 'middle';
  context.fillStyle = fill;
  context.fillText(value, x, y);
}

function crop(context: SKRSContext2D, value: string, maxWidth: number, size: number): string {
  context.font = `700 ${size}px ${imageFont}`;
  if (context.measureText(value).width <= maxWidth) return value;
  let result = value;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth)
    result = result.slice(0, -1);
  return `${result.trim()}…`;
}

function header(context: SKRSContext2D, page: number, totalPages: number): void {
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = INK;
  context.fillRect(40, 28, 124, 34);
  text(context, 'FUTHUB', 102, 46, 15, BACKGROUND, 'center', 900);
  text(context, 'MERCADO / PACKS', 40, 108, 43, INK, 'left', 900);
  text(context, `PÁGINA ${page} / ${totalPages}`, 1_160, 44, 14, MUTE, 'right', 600);
  text(context, 'ESCOLHA. ABRA. MONTE SEU TIME.', 1_160, 104, 13, INK, 'right', 700);
  context.fillStyle = INK;
  context.fillRect(40, 142, 1_120, 2);
}

function packArt(
  context: SKRSContext2D,
  pack: PackTile,
  centerX: number,
  centerY: number,
  scale: number,
): void {
  const tier = packTier(pack.price);
  const width = 190 * scale;
  const height = 252 * scale;
  context.save();
  context.translate(centerX, centerY);

  context.beginPath();
  context.roundRect(-width / 2, -height / 2, width, height, 12 * scale);
  const foil = context.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
  foil.addColorStop(0, color(tier.bright));
  foil.addColorStop(0.45, color(tier.mid));
  foil.addColorStop(1, color(tier.dark));
  context.fillStyle = foil;
  context.fill();

  context.save();
  context.beginPath();
  context.roundRect(-width / 2, -height / 2, width, height, 12 * scale);
  context.clip();
  context.fillStyle = 'rgba(255,255,255,0.13)';
  for (let offset = -height; offset < height; offset += 32 * scale) {
    context.save();
    context.translate(offset, 0);
    context.rotate(-0.55);
    context.fillRect(-4 * scale, -height, 8 * scale, height * 2);
    context.restore();
  }
  context.restore();

  context.strokeStyle = 'rgba(255,255,255,0.8)';
  context.lineWidth = 2 * scale;
  context.beginPath();
  context.roundRect(
    -width / 2 + 8 * scale,
    -height / 2 + 8 * scale,
    width - 16 * scale,
    height - 16 * scale,
    8 * scale,
  );
  context.stroke();

  context.fillStyle = 'rgba(17,17,17,0.82)';
  context.beginPath();
  context.moveTo(-43 * scale, -18 * scale);
  context.lineTo(0, -48 * scale);
  context.lineTo(43 * scale, -18 * scale);
  context.lineTo(35 * scale, 35 * scale);
  context.lineTo(0, 58 * scale);
  context.lineTo(-35 * scale, 35 * scale);
  context.closePath();
  context.fill();
  text(context, 'FH', 0, 6 * scale, 32 * scale, WHITE, 'center', 900);
  text(context, tier.label, 0, 88 * scale, 12 * scale, WHITE, 'center', 900);
  context.restore();
}

function favoriteBadge(context: SKRSContext2D, x: number, y: number): void {
  context.fillStyle = BACKGROUND;
  context.beginPath();
  context.roundRect(x, y, 90, 28, 14);
  context.fill();
  context.strokeStyle = HAIRLINE;
  context.stroke();
  text(context, 'FAVORITO', x + 45, y + 14, 10, INK, 'center', 800);
}

function packCard(context: SKRSContext2D, pack: PackTile, index: number): void {
  const x = 40 + index * 280;
  const width = 260;
  context.fillStyle = CLOUD;
  context.fillRect(x, 176, width, 300);
  packArt(context, pack, x + width / 2, 326, 0.94);
  if (pack.favorite) favoriteBadge(context, x + 14, 190);

  text(context, crop(context, pack.name, width, 20), x, 510, 20, INK, 'left', 700);
  text(context, packTier(pack.price).label, x, 540, 12, MUTE, 'left', 600);
  text(
    context,
    `${pack.cardsAmount} ${pack.cardsAmount === 1 ? 'carta' : 'cartas'} · limite ${pack.limitPerUser}`,
    x,
    572,
    13,
    MUTE,
    'left',
    500,
  );
  text(context, pack.price.toLocaleString('pt-BR'), x, 620, 24, INK, 'left', 700);
  text(context, 'MOEDAS', x + width, 620, 11, MUTE, 'right', 700);
}

function empty(context: SKRSContext2D): void {
  context.fillStyle = CLOUD;
  context.fillRect(40, 176, 1_120, 459);
  text(context, 'EM BREVE', 600, 360, 82, INK, 'center', 900);
  text(context, 'NOVOS PACKS ESTÃO CHEGANDO.', 600, 430, 16, MUTE, 'center', 600);
}

export function renderPacksImage({ items, page, totalPages }: PacksImage): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const context = canvas.getContext('2d');
  header(context, page, totalPages);

  const packs = items.slice(0, 4);
  if (packs.length === 0) empty(context);
  else packs.forEach((pack, index) => packCard(context, pack, index));

  return canvas.toBuffer('image/png');
}
