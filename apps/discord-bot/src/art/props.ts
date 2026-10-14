import type { TeamResponse } from '../features/team/team-session.js';
import { type Ctx, INK, type Icon, alpha, box, display, glow, gradient, write } from './kit.js';

/**
 * Ícones e ilustrações vetoriais das imagens: moedas, pack, escudo da divisão, prancheta tática,
 * campo com formação. Nada depende de arquivo externo.
 */

// ── Ícones ──────────────────────────────────────────────────────────────────────────────

export function chevron(context: Ctx, x: number, y: number, color = INK.body): void {
  context.beginPath();
  context.moveTo(x - 3, y - 6);
  context.lineTo(x + 3, y);
  context.lineTo(x - 3, y + 6);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke();
  context.lineCap = 'butt';
  context.lineJoin = 'miter';
}

export const coinsIcon: Icon = (context, x, y, color) => {
  for (const offset of [6, 0, -6]) {
    context.beginPath();
    context.ellipse(x, y + offset, 8, 3.2, 0, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = INK.canvas;
    context.lineWidth = 1.2;
    context.stroke();
  }
};

export const peopleIcon: Icon = (context, x, y, color) => {
  context.fillStyle = color;
  for (const [dx, scale] of [
    [-7, 0.75],
    [7, 0.75],
    [0, 1],
  ] as const) {
    context.beginPath();
    context.arc(x + dx, y - 4 * scale, 3.6 * scale, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(x + dx, y + 6, 6.5 * scale, 4.5 * scale, 0, Math.PI, 0);
    context.fill();
  }
};

export const cardsIcon: Icon = (context, x, y, color) => {
  for (const [angle, shade] of [
    [-0.25, 0.55],
    [0.12, 1],
  ] as const) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    box(context, -5.5, -8, 11, 16, 2);
    context.fillStyle = alpha(color, shade);
    context.fill();
    context.restore();
  }
};

export const strengthIcon: Icon = (context, x, y, color) => {
  context.fillStyle = color;
  context.fillRect(x - 6, y - 1.5, 12, 3);
  for (const side of [-1, 1]) {
    box(context, x + side * 8 - 2, y - 7, 4, 14, 1.5);
    context.fill();
    box(context, x + side * 12 - 1.5, y - 4.5, 3, 9, 1.5);
    context.fill();
  }
};

export function clipboard(context: Ctx, x: number, y: number, w: number, h: number, color: string) {
  box(context, x, y, w, h, w * 0.12);
  context.strokeStyle = color;
  context.lineWidth = Math.max(1.5, w * 0.06);
  context.stroke();
  box(context, x + w * 0.3, y - h * 0.06, w * 0.4, h * 0.13, w * 0.05);
  context.fillStyle = color;
  context.fill();
}

export const clipboardIcon: Icon = (context, x, y, color) => {
  clipboard(context, x - 6.5, y - 7, 13, 16, color);
  context.fillRect(x - 3.5, y - 1, 7, 1.6);
  context.fillRect(x - 3.5, y + 3, 7, 1.6);
};

export function home(context: Ctx, x: number, y: number, color: string): void {
  context.beginPath();
  context.moveTo(x - 8, y - 1);
  context.lineTo(x, y - 8);
  context.lineTo(x + 8, y - 1);
  context.lineTo(x + 6, y - 1);
  context.lineTo(x + 6, y + 7);
  context.lineTo(x + 2, y + 7);
  context.lineTo(x + 2, y + 2);
  context.lineTo(x - 2, y + 2);
  context.lineTo(x - 2, y + 7);
  context.lineTo(x - 6, y + 7);
  context.lineTo(x - 6, y - 1);
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

export function clock(context: Ctx, x: number, y: number, color: string): void {
  context.beginPath();
  context.arc(x, y, 8, 0, Math.PI * 2);
  context.moveTo(x, y - 4.5);
  context.lineTo(x, y);
  context.lineTo(x + 3.5, y + 2);
  context.strokeStyle = color;
  context.lineWidth = 1.8;
  context.lineCap = 'round';
  context.stroke();
  context.lineCap = 'butt';
}

/** Taça; aceita gradiente para a versão grande. */
export function trophy(
  context: Ctx,
  x: number,
  y: number,
  color: string | ReturnType<typeof gradient>,
): void {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x - 9, y - 10);
  context.lineTo(x + 9, y - 10);
  context.bezierCurveTo(x + 9, y + 2, x + 4, y + 5, x, y + 5);
  context.bezierCurveTo(x - 4, y + 5, x - 9, y + 2, x - 9, y - 10);
  context.fill();
  context.fillRect(x - 1.5, y + 4, 3, 5);
  context.fillRect(x - 6, y + 9, 12, 3);
  context.beginPath();
  context.arc(x - 9, y - 5, 4, Math.PI * 0.5, Math.PI * 1.5);
  context.arc(x + 9, y - 5, 4, Math.PI * 1.5, Math.PI * 0.5);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.stroke();
}

// ── Ilustrações ─────────────────────────────────────────────────────────────────────────

/** Pilha de moedas vista de lado; `tones` = [face, borda, sombra]. */
export function coinStack(
  context: Ctx,
  x: number,
  base: number,
  count: number,
  r: number,
  tones: readonly [string, string, string],
): void {
  const thickness = r * 0.24;
  for (let index = 0; index < count; index += 1) {
    const y = base - index * thickness;
    context.beginPath();
    context.ellipse(x, y + thickness * 0.5, r, r * 0.34, 0, 0, Math.PI);
    context.lineTo(x - r, y);
    context.ellipse(x, y, r, r * 0.34, 0, Math.PI, Math.PI * 2);
    context.closePath();
    context.fillStyle = tones[1];
    context.fill();
    context.strokeStyle = tones[2];
    context.lineWidth = 1;
    context.stroke();
  }
  const top = base - (count - 1) * thickness;
  context.beginPath();
  context.ellipse(x, top - thickness * 0.1, r, r * 0.34, 0, 0, Math.PI * 2);
  context.fillStyle = tones[0];
  context.fill();
  context.beginPath();
  context.ellipse(x, top - thickness * 0.1, r * 0.66, r * 0.22, 0, 0, Math.PI * 2);
  context.strokeStyle = tones[2];
  context.stroke();
}

export function bigCoin(context: Ctx, x: number, y: number, r: number): void {
  glow(context, x, y, r * 2, INK.gold, 0.25);
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.fillStyle = gradient(context, x - r, y - r, x + r, y + r, [
    [0, '#ffe08a'],
    [0.5, '#e0a321'],
    [1, '#8a5a0c'],
  ]);
  context.fill();
  context.beginPath();
  context.arc(x, y, r * 0.78, 0, Math.PI * 2);
  context.strokeStyle = 'rgba(90, 55, 5, 0.6)';
  context.lineWidth = 2;
  context.stroke();
  write(context, 'FH', x, y + 1, display(r * 0.9, 700), '#7a4c06', 'center', -1);
}

export function crowd(context: Ctx, x: number, base: number, color: string): void {
  for (const [dx, scale] of [
    [-62, 0.8],
    [58, 0.82],
    [-26, 0.95],
    [24, 1],
  ] as const) {
    const cx = x + dx;
    const head = base - 82 * scale;
    context.beginPath();
    context.arc(cx, head, 13 * scale, 0, Math.PI * 2);
    context.moveTo(cx - 34 * scale, base);
    context.bezierCurveTo(cx - 34 * scale, head + 20, cx - 20 * scale, head + 16, cx, head + 16);
    context.bezierCurveTo(
      cx + 20 * scale,
      head + 16,
      cx + 34 * scale,
      head + 20,
      cx + 34 * scale,
      base,
    );
    context.closePath();
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.05)';
    context.lineWidth = 1;
    context.stroke();
  }
}

export function pack(context: Ctx, x: number, y: number, w: number, h: number, lit: boolean): void {
  context.save();
  context.translate(x, y);
  context.rotate(0.14);
  if (lit) glow(context, 0, 0, w * 1.1, INK.gold, 0.2);
  box(context, -w / 2, -h / 2, w, h, 6);
  context.fillStyle = lit
    ? gradient(context, -w / 2, -h / 2, w / 2, h / 2, [
        [0, '#8a6514'],
        [0.45, '#3d2c08'],
        [1, '#1d1504'],
      ])
    : 'rgba(255,255,255,0.04)';
  context.fill();
  context.strokeStyle = lit ? alpha(INK.gold, 0.6) : 'rgba(255,255,255,0.1)';
  context.lineWidth = 1.5;
  context.stroke();
  for (const edge of [-1, 1]) {
    context.fillStyle = lit ? alpha(INK.gold, 0.35) : 'rgba(255,255,255,0.06)';
    context.fillRect(-w / 2 + 4, edge * (h / 2 - 9) - 2, w - 8, 4);
  }
  context.transform(1, 0, -0.14, 1, 0, 0);
  box(context, -w * 0.22, -w * 0.2, w * 0.44, w * 0.4, 3);
  context.strokeStyle = lit ? alpha(INK.gold, 0.7) : 'rgba(255,255,255,0.12)';
  context.stroke();
  write(
    context,
    'FH',
    0,
    2,
    display(w * 0.3, 700),
    lit ? alpha(INK.gold, 0.8) : 'rgba(255,255,255,0.15)',
    'center',
    -1,
  );
  context.restore();
}

/** Campo em perspectiva com a formação: posição preenchida acende. */
export function pitch(
  context: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  team: TeamResponse,
) {
  const skew = w * 0.16;
  const at = (u: number, v: number): [number, number] => [
    x + skew * (1 - v) + u * (w - 2 * skew * (1 - v)),
    y + v * h,
  ];
  const line = (points: readonly [number, number][]) => {
    context.beginPath();
    for (const [index, [u, v]] of points.entries()) {
      const [px, py] = at(u, v);
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.stroke();
  };
  context.strokeStyle = alpha(INK.success, 0.22);
  context.lineWidth = 1.2;
  line([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ]);
  line([
    [0, 0.5],
    [1, 0.5],
  ]);
  line([
    [0.25, 0],
    [0.25, 0.16],
    [0.75, 0.16],
    [0.75, 0],
  ]);
  line([
    [0.25, 1],
    [0.25, 0.84],
    [0.75, 0.84],
    [0.75, 1],
  ]);
  const [cx, cy] = at(0.5, 0.5);
  context.beginPath();
  context.ellipse(cx, cy, w * 0.1, h * 0.07, 0, 0, Math.PI * 2);
  context.stroke();

  const filled = [...team.lineup];
  for (const slot of team.formation.slots) {
    const index = filled.findIndex(({ holderPosition }) => holderPosition === slot.position);
    if (index >= 0) filled.splice(index, 1);
    const [px, py] = at(0.08 + (slot.x / 100) * 0.84, 0.06 + (slot.y / 100) * 0.88);
    if (index >= 0) glow(context, px, py, 12, INK.success, 0.5);
    context.beginPath();
    context.arc(px, py, 4.5, 0, Math.PI * 2);
    context.fillStyle = index >= 0 ? INK.success : 'rgba(255,255,255,0.14)';
    context.fill();
  }
}

export function shield(
  context: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  const path = (inset: number) => {
    const left = x - w / 2 + inset;
    const right = x + w / 2 - inset;
    const top = y - h / 2 + inset;
    context.beginPath();
    context.moveTo(x, top);
    context.bezierCurveTo(
      x + w * 0.2,
      top + h * 0.07,
      right - w * 0.05,
      top + h * 0.07,
      right,
      top + h * 0.06,
    );
    context.bezierCurveTo(right, y + h * 0.18, x + w * 0.22, y + h * 0.38, x, y + h / 2 - inset);
    context.bezierCurveTo(x - w * 0.22, y + h * 0.38, left, y + h * 0.18, left, top + h * 0.06);
    context.bezierCurveTo(left + w * 0.05, top + h * 0.07, x - w * 0.2, top + h * 0.07, x, top);
    context.closePath();
  };
  glow(context, x, y, w, color, 0.25);
  path(0);
  context.fillStyle = gradient(context, x - w / 2, y - h / 2, x + w / 2, y + h / 2, [
    [0, '#ffffff'],
    [0.08, color],
    [1, '#1a0f06'],
  ]);
  context.fill();
  path(7);
  context.fillStyle = gradient(context, x, y - h / 2, x, y + h / 2, [
    [0, 'rgba(40, 24, 12, 0.95)'],
    [1, 'rgba(14, 8, 4, 0.95)'],
  ]);
  context.fill();
  context.strokeStyle = alpha(color, 0.5);
  context.lineWidth = 1.5;
  context.stroke();

  for (const dy of [-0.31, 0.3]) star(context, x, y + h * dy, 6.5, color);

  const r = w * 0.22;
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.fillStyle = gradient(context, x - r, y - r, x + r, y + r, [
    [0, '#f2d3b0'],
    [1, color],
  ]);
  context.fill();
  context.strokeStyle = '#2a170a';
  context.lineWidth = 1.5;
  context.stroke();
  const pentagon = (cx: number, cy: number, size: number, turn: number) => {
    context.beginPath();
    for (let index = 0; index < 5; index += 1) {
      const angle = turn + (index * Math.PI * 2) / 5;
      const px = cx + Math.cos(angle) * size;
      const py = cy + Math.sin(angle) * size;
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fillStyle = '#2a170a';
    context.fill();
  };
  pentagon(x, y, r * 0.36, -Math.PI / 2);
  context.save();
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.clip();
  for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
    pentagon(
      x + Math.cos(angle) * r * 0.95,
      y + Math.sin(angle) * r * 0.95,
      r * 0.3,
      angle + Math.PI / 5,
    );
  }
  context.restore();
}

export function star(context: Ctx, x: number, y: number, r: number, color: string): void {
  context.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? r : r * 0.45;
    context.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

/** Prancheta tática do estado vazio das missões. */
export function tactics(context: Ctx, x: number, y: number): void {
  glow(context, x, y, 70, INK.success, 0.12);
  context.save();
  context.translate(x, y);
  context.rotate(-0.08);
  clipboard(context, -32, -38, 64, 78, alpha(INK.success, 0.75));
  context.strokeStyle = alpha(INK.success, 0.75);
  context.lineWidth = 2;
  for (const [cx, cy] of [
    [-14, -14],
    [14, -20],
    [6, 22],
  ] as const) {
    context.beginPath();
    context.moveTo(cx - 4, cy - 4);
    context.lineTo(cx + 4, cy + 4);
    context.moveTo(cx + 4, cy - 4);
    context.lineTo(cx - 4, cy + 4);
    context.stroke();
  }
  context.beginPath();
  context.arc(16, 2, 4, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([3, 3]);
  context.beginPath();
  context.moveTo(-14, -6);
  context.quadraticCurveTo(-14, 10, 10, 4);
  context.stroke();
  context.setLineDash([]);
  context.restore();
}

export function spinner(context: Ctx, x: number, y: number, r: number, color: string): void {
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.strokeStyle = alpha(color, 0.15);
  context.lineWidth = 3;
  context.stroke();
  context.beginPath();
  context.arc(x, y, r, Math.PI * 0.9, Math.PI * 2.3);
  context.strokeStyle = color;
  context.lineCap = 'round';
  context.stroke();
  context.lineCap = 'butt';
}

export const starIcon: Icon = (context, x, y, color) => star(context, x, y, 9.5, color);

export const giftIcon: Icon = (context, x, y, color) => {
  context.fillStyle = color;
  context.fillRect(x - 7, y - 1, 14, 9);
  context.fillRect(x - 8.5, y - 5, 17, 4);
  context.fillStyle = INK.canvas;
  context.fillRect(x - 1, y - 5, 2, 13);
  context.beginPath();
  context.ellipse(x - 3.5, y - 7.5, 3.5, 2, -0.5, 0, Math.PI * 2);
  context.ellipse(x + 3.5, y - 7.5, 3.5, 2, 0.5, 0, Math.PI * 2);
  context.strokeStyle = color;
  context.lineWidth = 1.6;
  context.stroke();
};

export const ballIcon: Icon = (context, x, y, color) => {
  context.beginPath();
  context.arc(x, y, 8.5, 0, Math.PI * 2);
  context.strokeStyle = color;
  context.lineWidth = 1.8;
  context.stroke();
  context.beginPath();
  for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
    context.lineTo(x + Math.cos(angle) * 3.6, y + Math.sin(angle) * 3.6);
  }
  context.closePath();
  context.fillStyle = color;
  context.fill();
};

/** Círculo cheio com um visto. */
export function check(context: Ctx, x: number, y: number, size: number, color: string): void {
  context.beginPath();
  context.arc(x, y, size / 2, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.beginPath();
  context.moveTo(x - size * 0.22, y);
  context.lineTo(x - size * 0.05, y + size * 0.18);
  context.lineTo(x + size * 0.25, y - size * 0.18);
  context.strokeStyle = INK.canvas;
  context.lineWidth = size * 0.12;
  context.lineCap = 'round';
  context.stroke();
  context.lineCap = 'butt';
}
