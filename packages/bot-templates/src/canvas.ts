import { type Scope, expand, itemScope } from './expand.js';
import { httpUrl } from './render.js';
import type {
  CanvasImage,
  ImageLayer,
  ItemLayer,
  ListItem,
  RectLayer,
  TextLayer,
} from './types.js';

export type Drawable = { width: number; height: number };

/** The subset of CanvasRenderingContext2D shared by browsers and @napi-rs/canvas. */
export interface Canvas2D<I extends Drawable> {
  globalAlpha: number;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  createLinearGradient(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): { addColorStop(offset: number, color: string): void };
  drawImage(
    image: I,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
}

export type ImageLoader<I extends Drawable> = (url: string) => Promise<I | null>;

type Placed = { layer: ItemLayer; dx: number; dy: number; scope: Scope };

/** Flattens list layers into positioned item layers, in paint order. */
export function placeLayers(image: CanvasImage, scope: Scope): Placed[] {
  return image.layers.flatMap((layer): Placed[] => {
    if (layer.type !== 'list') return [{ layer, dx: 0, dy: 0, scope }];
    const value = scope.data[layer.source];
    const items: ListItem[] = Array.isArray(value) ? value : [];
    const columns = Math.max(1, layer.columns);
    return items.slice(0, Math.max(0, layer.limit)).flatMap((item, index) => {
      const dx = layer.x + (index % columns) * (layer.cellWidth + layer.gapX);
      const dy = layer.y + Math.floor(index / columns) * (layer.cellHeight + layer.gapY);
      const local = itemScope(scope, item, index);
      return layer.layers.map((child) => ({ layer: child, dx, dy, scope: local }));
    });
  });
}

function roundedPath<I extends Drawable>(
  ctx: Canvas2D<I>,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function progressWidth(layer: RectLayer, scope: Scope): number {
  if (!layer.progress.trim()) return layer.w;
  const value = Number(expand(layer.progress, scope).replace(',', '.'));
  return Number.isFinite(value) ? (layer.w * Math.max(0, Math.min(100, value))) / 100 : 0;
}

function drawRect<I extends Drawable>(
  ctx: Canvas2D<I>,
  layer: RectLayer,
  x: number,
  y: number,
  scope: Scope,
) {
  const w = progressWidth(layer, scope);
  if (w <= 0) return;
  roundedPath(ctx, x, y, w, layer.h, layer.radius);
  if (layer.fill) {
    if (layer.fill2) {
      const gradient = ctx.createLinearGradient(x, y, x, y + layer.h);
      gradient.addColorStop(0, layer.fill);
      gradient.addColorStop(1, layer.fill2);
      ctx.fillStyle = gradient;
    } else ctx.fillStyle = layer.fill;
    ctx.fill();
  }
  if (layer.stroke && layer.strokeWidth > 0) {
    ctx.strokeStyle = layer.stroke;
    ctx.lineWidth = layer.strokeWidth;
    ctx.stroke();
  }
}

export function wrapText<I extends Drawable>(
  ctx: Canvas2D<I>,
  value: string,
  width: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] ?? '';
  while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

function drawText<I extends Drawable>(
  ctx: Canvas2D<I>,
  layer: TextLayer,
  x: number,
  y: number,
  scope: Scope,
  font: string,
) {
  let value = expand(layer.text, { ...scope, stripEmojis: true }).trim();
  if (layer.uppercase) value = value.toLocaleUpperCase('pt-BR');
  if (!value.trim()) return;
  ctx.font = `${layer.weight} ${layer.size}px "${font}"`;
  ctx.fillStyle = layer.color;
  ctx.textBaseline = 'top';
  ctx.textAlign = layer.align;
  const anchor =
    layer.align === 'center' ? x + layer.w / 2 : layer.align === 'right' ? x + layer.w : x;
  wrapText(ctx, value, layer.w, Math.max(1, layer.lines)).forEach((line, index) => {
    let fitted = line;
    // A single word wider than the box is cut instead of spilling out of it.
    if (ctx.measureText(fitted).width > layer.w) {
      while (fitted && ctx.measureText(`${fitted}…`).width > layer.w) fitted = fitted.slice(0, -1);
      fitted = `${fitted.trimEnd()}…`;
    }
    ctx.fillText(fitted, anchor, y + index * layer.size * 1.2);
  });
}

function drawPicture<I extends Drawable>(
  ctx: Canvas2D<I>,
  layer: ImageLayer,
  x: number,
  y: number,
  picture: I,
) {
  const scale =
    layer.fit === 'cover'
      ? Math.max(layer.w / picture.width, layer.h / picture.height)
      : Math.min(layer.w / picture.width, layer.h / picture.height);
  const w = picture.width * scale;
  const h = picture.height * scale;
  ctx.save();
  roundedPath(ctx, x, y, layer.w, layer.h, layer.radius);
  ctx.clip();
  ctx.drawImage(
    picture,
    0,
    0,
    picture.width,
    picture.height,
    x + (layer.w - w) / 2,
    y + (layer.h - h) / 2,
    w,
    h,
  );
  ctx.restore();
}

/** Every HTTP(S) URL the image needs, so callers can preload them in parallel. */
export function imageUrls(image: CanvasImage, scope: Scope): string[] {
  const urls = placeLayers(image, scope).flatMap(({ layer, scope: local }) => {
    if (layer.type !== 'image') return [];
    const url = httpUrl(expand(layer.url, local).trim());
    return url ? [url] : [];
  });
  return [...new Set(urls)];
}

export async function drawCanvas<I extends Drawable>(
  ctx: Canvas2D<I>,
  image: CanvasImage,
  scope: Scope,
  load: ImageLoader<I>,
  font = 'Fira Sans',
): Promise<void> {
  const pictures = new Map<string, I | null>();
  await Promise.all(
    imageUrls(image, scope).map(async (url) => {
      pictures.set(url, await load(url).catch(() => null));
    }),
  );
  ctx.save();
  if (image.background) {
    ctx.fillStyle = image.background;
    ctx.fillRect(0, 0, image.width, image.height);
  }
  for (const { layer, dx, dy, scope: local } of placeLayers(image, scope)) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
    const x = dx + layer.x;
    const y = dy + layer.y;
    if (layer.type === 'rect') drawRect(ctx, layer, x, y, local);
    else if (layer.type === 'text') drawText(ctx, layer, x, y, local, font);
    else {
      const url = httpUrl(expand(layer.url, local).trim());
      const picture = url ? pictures.get(url) : null;
      if (picture && picture.width > 0 && picture.height > 0)
        drawPicture(ctx, layer, x, y, picture);
    }
    ctx.restore();
  }
  ctx.restore();
}
