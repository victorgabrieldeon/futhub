import type { ClubResponse } from '../features/team/team-session.js';
import {
  type Ctx,
  INK,
  type Icon,
  alpha,
  badge,
  bar,
  box,
  display,
  fit,
  fmt,
  glow,
  gradient,
  mono,
  raised,
  stat,
  write,
} from './kit.js';
import { clipboardIcon, clock, coinsIcon, peopleIcon, trophy } from './props.js';

const NEON = INK.success;
const GOLD = INK.gold;
const RED = INK.danger;
const TOP = 92;
const BOTTOM = 786;

export const stadiumIcon: Icon = (context, x, y, color) => {
  context.strokeStyle = color;
  context.lineWidth = 1.6;
  context.beginPath();
  context.ellipse(x, y + 1, 9, 5, 0, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(x - 9, y + 1);
  context.lineTo(x - 9, y + 6);
  context.ellipse(x, y + 6, 9, 3.5, 0, Math.PI, 0, true);
  context.lineTo(x + 9, y + 1);
  context.stroke();
  for (const side of [-1, 1]) {
    context.fillStyle = color;
    context.fillRect(x + side * 7 - 0.8, y - 9, 1.6, 6);
    context.fillRect(x + side * 7 - 2.5, y - 10, 5, 2);
  }
};

/** Estádio em perspectiva: cada nível acende um anel de arquibancada; do 3º em diante, torres. */
function stadium(context: Ctx, cx: number, cy: number, level: number, maxLevel: number): void {
  const rings = Math.max(1, maxLevel);
  const lit = level / rings;
  glow(context, cx, cy, 200, NEON, 0.1 + lit * 0.18);
  for (let index = rings - 1; index >= 0; index -= 1) {
    const rx = 92 + index * 18;
    const ry = 34 + index * 8;
    const on = index < level;
    context.beginPath();
    context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    context.fillStyle = on
      ? gradient(context, cx, cy - ry, cx, cy + ry, [
          [0, alpha(NEON, 0.22 - index * 0.025)],
          [1, 'rgba(6, 14, 10, 0.9)'],
        ])
      : 'rgba(255,255,255,0.025)';
    context.fill();
    context.strokeStyle = on ? alpha(NEON, 0.55) : 'rgba(255,255,255,0.1)';
    context.lineWidth = on ? 1.5 : 1;
    context.stroke();
  }
  context.beginPath();
  context.ellipse(cx, cy, 80, 28, 0, 0, Math.PI * 2);
  context.fillStyle = gradient(context, cx, cy - 28, cx, cy + 28, [
    [0, '#1b6b3c'],
    [1, '#0d3d21'],
  ]);
  context.fill();
  context.strokeStyle = alpha(INK.white, 0.35);
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(cx, cy, 58, 18, 0, 0, Math.PI * 2);
  context.moveTo(cx, cy - 18);
  context.lineTo(cx, cy + 18);
  context.stroke();
  if (level < 3) return;
  const towers = level >= maxLevel ? 4 : 2;
  const spread = 92 + (rings - 1) * 18 + 14;
  for (let index = 0; index < towers; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const back = index >= 2;
    const x = cx + side * (back ? spread * 0.62 : spread);
    const base = cy + (back ? -18 : 10);
    const top = base - (back ? 70 : 92);
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(x - 1.2, top, 2.4, base - top);
    glow(context, x, top, 30, '#ffffff', 0.35);
    box(context, x - 9, top - 5, 18, 8, 2);
    context.fillStyle = 'rgba(255,255,255,0.9)';
    context.fill();
  }
}

function pips(context: Ctx, x: number, y: number, w: number, level: number, maxLevel: number) {
  const count = Math.max(1, maxLevel);
  const gap = 8;
  const width = (w - gap * (count - 1)) / count;
  for (let index = 0; index < count; index += 1) {
    const px = x + index * (width + gap);
    const on = index < level;
    if (on && index === level - 1) glow(context, px + width / 2, y + 5, 28, NEON, 0.35);
    box(context, px, y, width, 10, 5);
    context.fillStyle = on ? NEON : 'rgba(255,255,255,0.08)';
    context.fill();
  }
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : '−'}${fmt(Math.abs(value))}`;
}

function stadiumPanel(context: Ctx, club: ClubResponse): void {
  const x = 34;
  const w = 420;
  const { stadium: info } = club;
  raised(context, x, TOP, w, BOTTOM - TOP);
  badge(context, x + 36, TOP + 36, NEON, 18);
  stadiumIcon(context, x + 36, TOP + 36, NEON);
  write(context, 'ESTÁDIO', x + 64, TOP + 37, mono(12, 500), INK.body, 'left', 2);
  stadium(context, x + w / 2, TOP + 178, info.level, info.maxLevel);

  const left = x + 28;
  const level = String(info.level).padStart(2, '0');
  const width = write(context, level, left - 4, TOP + 352, display(140, 700), INK.white);
  write(
    context,
    `DE ${info.maxLevel} NÍVEIS`,
    left + width + 6,
    TOP + 384,
    mono(13, 600),
    INK.body,
    'left',
    2,
  );
  pips(context, left, TOP + 424, w - 56, info.level, info.maxLevel);

  const half = (w - 56) / 2;
  write(context, 'BILHETERIA', left, TOP + 476, mono(11, 500), INK.mute, 'left', 2);
  write(context, `+${fmt(info.ticketRevenue)}`, left, TOP + 514, display(38, 700), NEON);
  write(context, 'MANUTENÇÃO', left + half, TOP + 476, mono(11, 500), INK.mute, 'left', 2);
  write(context, `−${fmt(info.maintenance)}`, left + half, TOP + 514, display(38, 700), RED);

  context.fillStyle = 'rgba(255,255,255,0.1)';
  context.fillRect(left, TOP + 552, w - 56, 1);
  write(context, 'PRÓXIMA MELHORIA', left, TOP + 588, mono(11, 500), INK.mute, 'left', 2);
  if (info.nextUpgradeCost === null) {
    trophy(context, left + 12, TOP + 640, NEON);
    write(context, 'NÍVEL MÁXIMO', left + 34, TOP + 640, display(42, 700), NEON);
    return;
  }
  badge(context, left + 16, TOP + 640, GOLD, 16);
  coinsIcon(context, left + 16, TOP + 640, GOLD);
  fit(context, fmt(info.nextUpgradeCost), left + 42, TOP + 640, w - 110, 46, GOLD);
}

function sponsorPanel(context: Ctx, club: ClubResponse, x: number, w: number): void {
  const { sponsor } = club;
  const y = 424;
  const h = BOTTOM - y;
  raised(context, x, y, w, h, sponsor.completed ? NEON : undefined);
  badge(context, x + 36, y + 36, GOLD, 18);
  trophy(context, x + 36, y + 37, GOLD);
  write(context, 'PATROCINADOR', x + 64, y + 37, mono(12, 500), INK.body, 'left', 2);
  fit(context, sponsor.name.toUpperCase(), x + 26, y + 100, w - 52, 56, INK.white);

  write(context, 'PARTIDAS NA SEMANA', x + 28, y + 160, mono(11, 500), INK.mute, 'left', 2);
  write(
    context,
    `${sponsor.weeklyMatches}/${sponsor.weeklyGoal}`,
    x + w - 28,
    y + 160,
    display(26, 700),
    sponsor.completed ? NEON : INK.white,
    'right',
  );
  bar(
    context,
    x + 28,
    y + 182,
    w - 56,
    12,
    sponsor.weeklyMatches / Math.max(1, sponsor.weeklyGoal),
    sponsor.completed ? NEON : GOLD,
  );

  context.fillStyle = 'rgba(255,255,255,0.1)';
  context.fillRect(x + 28, y + 226, w - 56, 1);
  write(context, 'PAGAMENTO', x + 28, y + 262, mono(11, 500), INK.mute, 'left', 2);
  write(context, `+${fmt(sponsor.payout)}`, x + 28, y + 310, display(52, 700), GOLD);
  const status = sponsor.completed ? 'META CONCLUÍDA' : 'EM ANDAMENTO';
  const tone = sponsor.completed ? NEON : INK.info;
  write(context, 'STATUS', x + w / 2, y + 262, mono(11, 500), INK.mute, 'left', 2);
  context.font = mono(13, 600);
  context.letterSpacing = '2px';
  const chip = context.measureText(status).width + 44;
  context.letterSpacing = '0px';
  box(context, x + w / 2, y + 290, chip, 40, 20);
  context.fillStyle = alpha(tone, 0.14);
  context.fill();
  context.strokeStyle = alpha(tone, 0.6);
  context.lineWidth = 1.5;
  context.stroke();
  glow(context, x + w / 2 + 18, y + 310, 9, tone, 0.6);
  context.beginPath();
  context.arc(x + w / 2 + 18, y + 310, 4, 0, Math.PI * 2);
  context.fillStyle = tone;
  context.fill();
  write(context, status, x + w / 2 + 32, y + 311, mono(13, 600), tone, 'left', 2);
}

/** Aba Clube do painel do time: estádio à esquerda, finanças e patrocínio à direita. */
export function drawClubImage(context: Ctx, club: ClubResponse, width: number): void {
  stadiumPanel(context, club);
  const x = 470;
  const right = width - 34;
  const gap = 16;
  const w = (right - x - gap) / 2;
  const h = 150;
  stat(context, x, TOP, w, h, 'Saldo do clube', fmt(club.balance), undefined, INK.white, coinsIcon);
  stat(
    context,
    x + w + gap,
    TOP,
    w,
    h,
    'Próximo fechamento',
    signed(club.projectedNet),
    undefined,
    club.projectedNet >= 0 ? NEON : RED,
    clock,
  );
  stat(
    context,
    x,
    TOP + h + gap,
    w,
    h,
    'Folha salarial',
    `−${fmt(club.payroll)}`,
    undefined,
    RED,
    peopleIcon,
  );
  stat(
    context,
    x + w + gap,
    TOP + h + gap,
    w,
    h,
    'Meta do patrocínio',
    `${club.sponsor.weeklyMatches}/${club.sponsor.weeklyGoal} partidas`.toUpperCase(),
    undefined,
    club.sponsor.completed ? NEON : INK.white,
    clipboardIcon,
  );
  sponsorPanel(context, club, x, right - x);
}
