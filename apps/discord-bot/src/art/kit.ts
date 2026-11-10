import { type Canvas, type SKRSContext2D, createCanvas } from '@napi-rs/canvas';

import { displayFont, interfaceFont, monoFont } from './image-fonts.js';

/**
 * Peças de desenho das imagens do bot: noite de estádio em verde, cabeçalho com o monograma FH,
 * títulos condensados, rótulos mono e painéis com borda acesa. Toda imagem tem 1200 × 675.
 */
export const W = 1_200;
export const H = 675;

export const INK = {
  canvas: '#050908',
  raised: '#0d1511',
  raised2: '#16211b',
  line: 'rgba(255,255,255,0.09)',
  hairline: '#2c3832',
  white: '#ffffff',
  stage: '#f4f4f5',
  body: '#cacacb',
  mute: '#8f9893',
  success: '#22d16b',
  danger: '#ef4444',
  warning: '#f59e0b',
  gold: '#f4b42c',
  info: '#4f9cf7',
} as const;

/** Ícone vetorial centrado em (x, y), cabe num quadrado de ~20 px. */
export type Icon = (context: Ctx, x: number, y: number, color: string) => void;

type Weight = 400 | 500 | 600 | 700;
export type Ctx = SKRSContext2D;
export type Align = 'left' | 'center' | 'right';

export const display = (size: number, weight: Weight = 600) => `${weight} ${size}px ${displayFont}`;
export const ui = (size: number, weight: Weight = 400) => `${weight} ${size}px ${interfaceFont}`;
export const mono = (size: number, weight: Weight = 500) => `${weight} ${size}px ${monoFont}`;

export function write(
  context: Ctx,
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

export function crop(context: Ctx, value: string, maxWidth: number, font: string): string {
  context.font = font;
  if (context.measureText(value).width <= maxWidth) return value;
  let result = value;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth)
    result = result.slice(0, -1);
  return `${result.trim()}…`;
}

/** Texto que encolhe até caber, para nomes e números grandes. */
export function fit(
  context: Ctx,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  fill: string,
  align: Align = 'left',
  weight: Weight = 700,
): void {
  let current = size;
  context.font = display(current, weight);
  while (current > 14 && context.measureText(value).width > maxWidth) {
    current -= 2;
    context.font = display(current, weight);
  }
  write(
    context,
    crop(context, value, maxWidth, display(current, weight)),
    x,
    y,
    display(current, weight),
    fill,
    align,
  );
}

export function alpha(hex: string, opacity: number): string {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

export function box(context: Ctx, x: number, y: number, w: number, h: number, radius = 16): void {
  context.beginPath();
  context.roundRect(x, y, w, h, radius);
}

/** Painel escuro com borda acesa; `accent` tinge o canto e reforça a borda. */
export function raised(
  context: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  accent?: string,
): void {
  if (accent) glow(context, x + w / 2, y + h / 2, Math.max(w, h) * 0.55, accent, 0.08);
  box(context, x, y, w, h, 14);
  context.fillStyle = gradient(context, x, y, x + Math.min(w, 600) * 0.5, y + h, [
    [0, accent ? alpha(accent, 0.12) : 'rgba(18, 28, 23, 0.94)'],
    [0.45, 'rgba(12, 18, 15, 0.94)'],
    [1, 'rgba(8, 12, 10, 0.95)'],
  ]);
  context.fill();
  context.strokeStyle = alpha(accent ?? INK.success, accent ? 0.6 : 0.22);
  context.lineWidth = accent ? 1.8 : 1.5;
  context.stroke();
}

export function gradient(
  context: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: readonly (readonly [number, string])[],
) {
  const value = context.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of stops) value.addColorStop(offset, color);
  return value;
}

/** Brilho radial na cor do momento (raridade, resultado, recompensa). */
export function glow(
  context: Ctx,
  x: number,
  y: number,
  radius: number,
  color: string,
  power = 0.45,
): void {
  const value = context.createRadialGradient(x, y, 0, x, y, radius);
  value.addColorStop(0, alpha(color, power));
  value.addColorStop(0.55, alpha(color, power * 0.25));
  value.addColorStop(1, alpha(color, 0));
  context.fillStyle = value;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** Raios de luz atrás do destaque, como no walkout dos jogos de futebol. */
export function rays(
  context: Ctx,
  x: number,
  y: number,
  color: string,
  count = 14,
  length = 620,
): void {
  context.save();
  context.translate(x, y);
  for (let index = 0; index < count; index += 1) {
    context.rotate((Math.PI * 2) / count);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(length, -34);
    context.lineTo(length, 34);
    context.closePath();
    context.fillStyle = alpha(color, index % 2 === 0 ? 0.1 : 0.05);
    context.fill();
  }
  context.restore();
}

/** Barra de progresso com ponta brilhante. */
export function bar(
  context: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  color: string,
): void {
  box(context, x, y, w, h, h / 2);
  context.fillStyle = 'rgba(255,255,255,0.08)';
  context.fill();
  const filled = Math.max(0, Math.min(1, ratio)) * w;
  if (filled <= 0) return;
  glow(context, x + filled, y + h / 2, h * 1.6, color, 0.35);
  box(context, x, y, Math.max(h, filled), h, h / 2);
  context.fillStyle = gradient(context, x, 0, x + w, 0, [
    [0, alpha(color, 0.7)],
    [1, color],
  ]);
  context.fill();
}

function streak(context: Ctx, x0: number, y0: number, x1: number, y1: number, power: number) {
  context.strokeStyle = gradient(context, x0, y0, x1, y1, [
    [0, alpha(INK.success, 0)],
    [0.5, alpha(INK.success, power)],
    [1, alpha(INK.success, 0)],
  ]);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x0, y0);
  context.lineTo(x1, y1);
  context.stroke();
}

/** Noite de estádio: fundo verde-escuro, refletores ao alto, feixes nos cantos e vinheta. */
export function backdrop(context: Ctx, extra?: (context: Ctx) => void): void {
  context.fillStyle = INK.canvas;
  context.fillRect(0, 0, W, H);
  glow(context, 130, 170, 420, INK.success, 0.14);
  glow(context, 640, 40, 380, INK.success, 0.08);
  glow(context, 160, H, 380, INK.success, 0.08);
  glow(context, W, H * 0.6, 360, INK.success, 0.06);
  extra?.(context);
  const lights: readonly (readonly [number, number])[] = [
    [470, 26],
    [505, 38],
    [540, 50],
    [580, 66],
    [618, 80],
    [654, 90],
  ];
  for (const [index, [x, y]] of lights.entries()) {
    glow(context, x, y, 14, '#ffffff', 0.35 - index * 0.03);
    context.fillStyle = 'rgba(255,255,255,0.85)';
    context.beginPath();
    context.arc(x, y, 1.8, 0, Math.PI * 2);
    context.fill();
  }
  streak(context, 0, 168, 70, 216, 0.5);
  streak(context, 0, 640, 110, 560, 0.45);
  streak(context, 30, H, 170, 590, 0.3);
  streak(context, W, 300, 1_130, 262, 0.25);
  const vignette = context.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, W, H);
}

/** Selo do canto superior direito; devolve o x onde ele começa. */
export function pill(context: Ctx, label: string, extra = 0, accent?: string): number {
  context.font = mono(12, 600);
  context.letterSpacing = '1.5px';
  const width = context.measureText(label).width + 32 + (accent ? 18 : 0) + extra;
  context.letterSpacing = '0px';
  const x = W - 34 - width;
  box(context, x, 26, width, 40, 10);
  context.fillStyle = 'rgba(10, 16, 13, 0.85)';
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.1)';
  context.lineWidth = 1;
  context.stroke();
  if (accent) {
    glow(context, x + 20, 46, 9, accent, 0.6);
    context.beginPath();
    context.arc(x + 20, 46, 3.5, 0, Math.PI * 2);
    context.fillStyle = accent;
    context.fill();
  }
  write(context, label, x + (accent ? 34 : 16), 47, mono(12, 600), INK.white, 'left', 1.5);
  return x;
}

/** Fundo e cabeçalho comuns. */
export function frame(
  context: Ctx,
  section: string,
  right?: string,
  accent: string = INK.success,
  icon?: Icon,
): void {
  backdrop(context);
  masthead(context, section, right, accent, icon);
}

/** Cabeçalho: monograma, seção com ícone e um selo à direita. */
export function masthead(
  context: Ctx,
  section: string,
  right?: string,
  accent: string = INK.success,
  icon?: Icon,
): void {
  context.save();
  context.translate(62, 46);
  context.transform(1, 0, -0.14, 1, 0, 0);
  box(context, -22, -21, 44, 42, 4);
  context.fillStyle = gradient(context, -22, -21, 22, 21, [
    [0, '#f2fff6'],
    [1, '#b6f0c9'],
  ]);
  context.fill();
  context.restore();
  write(context, 'FH', 62, 49, display(32, 700), INK.canvas, 'center', -2);
  const fut = write(context, 'Fut', 100, 46, ui(26, 700), INK.white, 'left', -1);
  const hub = write(context, 'Hub', 100 + fut, 46, ui(26, 700), INK.success, 'left', -1);
  context.fillStyle = 'rgba(255,255,255,0.18)';
  context.fillRect(116 + fut + hub, 32, 1, 28);
  let label = 132 + fut + hub;
  if (icon) {
    icon(context, label + 10, 46, INK.body);
    label += 30;
  }
  write(context, section.toUpperCase(), label, 47, mono(12, 500), INK.body, 'left', 2);
  if (right) pill(context, right.toUpperCase(), 0, accent);
}

/** Título condensado com linha fina embaixo; devolve o y livre seguinte. */
export function heading(context: Ctx, title: string, subtitle?: string, y = 120): number {
  fit(context, title.toUpperCase(), 38, y, subtitle ? 700 : 1_120, 64, INK.white, 'left', 700);
  if (subtitle)
    write(context, crop(context, subtitle, 400, ui(15)), 1_166, y + 8, ui(15), INK.body, 'right');
  context.fillStyle = gradient(context, 34, 0, 1_166, 0, [
    [0, alpha(INK.success, 0.5)],
    [0.4, 'rgba(255,255,255,0.1)'],
    [1, 'rgba(255,255,255,0.02)'],
  ]);
  context.fillRect(34, y + 36, 1_132, 1);
  return y + 58;
}

/** Rótulo mono espaçado acima de um título, como `JOGADOR` no início. */
export function eyebrow(
  context: Ctx,
  value: string,
  x: number,
  y: number,
  color: string = INK.success,
  align: Align = 'left',
): void {
  write(context, value.toUpperCase(), x, y, mono(13, 600), color, align, 3);
}

/** Círculo translúcido atrás de um ícone. */
export function badge(context: Ctx, x: number, y: number, color: string, r = 21): void {
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.fillStyle = alpha(color, 0.1);
  context.fill();
  context.strokeStyle = alpha(color, 0.28);
  context.lineWidth = 1;
  context.stroke();
}

/** Bloco de estatística: ícone e rótulo, valor grande e uma linha de apoio. */
export function stat(
  context: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  caption?: string,
  color: string = INK.white,
  icon?: Icon,
): void {
  raised(context, x, y, w, h, color === INK.white ? undefined : color);
  let labelX = x + 22;
  if (icon) {
    const tone = color === INK.white ? INK.success : color;
    badge(context, x + 36, y + 34, tone, 18);
    icon(context, x + 36, y + 34, tone);
    labelX = x + 64;
  }
  write(context, label.toUpperCase(), labelX, y + 35, mono(12, 500), INK.body, 'left', 2);
  fit(
    context,
    value,
    x + 22,
    y + h / 2 + (caption ? 10 : 18),
    w - 44,
    Math.min(64, h * 0.42),
    color,
  );
  if (caption)
    write(context, crop(context, caption, w - 44, ui(15)), x + 22, y + h - 24, ui(15), INK.white);
}

export function canvas(): { canvas: Canvas; context: Ctx } {
  const created = createCanvas(W, H);
  return { canvas: created, context: created.getContext('2d') };
}

export function png(target: Canvas): Buffer {
  return target.toBuffer('image/png');
}
