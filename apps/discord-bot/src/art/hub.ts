import type { DiscordIdentityDto, MissionsResponse } from '@futhub/api-client';

import type { LeaguePanelState, TeamResponse } from '../features/team/team-session.js';
import {
  type Ctx,
  INK,
  type Icon,
  W,
  alpha,
  backdrop,
  badge,
  bar,
  box,
  canvas,
  crop,
  display,
  fit,
  fmt,
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
import {
  bigCoin,
  cardsIcon,
  chevron,
  clipboardIcon,
  clock,
  coinStack,
  coinsIcon,
  crowd,
  home,
  pack,
  peopleIcon,
  pitch,
  shield,
  spinner,
  strengthIcon,
  tactics,
  trophy,
} from './props.js';
import { remoteImage } from './remote-image.js';

/**
 * Painel do início: noite de estádio em verde, cartões com ícone, ilustração e seta, como a tela
 * principal de um jogo de futebol. Tudo é desenhado em vetor; a única imagem externa é o avatar.
 */
const NEON = INK.success;
const GOLD = INK.gold;
const BLUE = INK.info;
const BG = INK.canvas;
const MARGIN = 34;
const RIGHT = W - MARGIN;

export type HubLook = Readonly<{
  identity: DiscordIdentityDto;
  team: TeamResponse;
  league: LeaguePanelState | null;
  missions: MissionsResponse | null;
}>;

function relative(value: string | null, now = Date.now()): string {
  if (!value) return 'agora';
  const minutes = Math.max(0, Math.round((new Date(value).getTime() - now) / 60_000));
  if (minutes < 1) return 'em instantes';
  if (minutes < 60) return `em ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `em ${hours}h ${minutes % 60}min` : `em ${hours}h`;
}

// ── Cenário ─────────────────────────────────────────────────────────────────────────────

/** Camisa 10 de costas, quase apagada, sob os refletores. */
function silhouette(context: Ctx, x: number, y: number): void {
  context.save();
  context.beginPath();
  context.arc(x, y + 34, 25, 0, Math.PI * 2);
  context.moveTo(x - 14, y + 56);
  context.lineTo(x + 14, y + 56);
  context.bezierCurveTo(x + 62, y + 70, x + 84, y + 78, x + 92, y + 118);
  context.lineTo(x + 128, y + 228);
  context.lineTo(x + 104, y + 238);
  context.lineTo(x + 70, y + 150);
  context.lineTo(x + 64, y + 290);
  context.lineTo(x - 64, y + 290);
  context.lineTo(x - 70, y + 150);
  context.lineTo(x - 112, y + 220);
  context.lineTo(x - 134, y + 206);
  context.lineTo(x - 92, y + 118);
  context.bezierCurveTo(x - 84, y + 78, x - 62, y + 70, x - 14, y + 56);
  context.closePath();
  context.fillStyle = gradient(context, x - 120, y, x + 120, y + 260, [
    [0, 'rgba(18, 30, 24, 0.55)'],
    [1, 'rgba(6, 10, 8, 0.2)'],
  ]);
  context.fill();
  context.strokeStyle = alpha(NEON, 0.08);
  context.lineWidth = 1.5;
  context.stroke();
  context.clip();
  write(context, '10', x + 2, y + 170, display(96, 700), 'rgba(255,255,255,0.05)', 'center');
  context.restore();
}

// ── Blocos ──────────────────────────────────────────────────────────────────────────────

/** Nome com a pontuação acesa em verde, como `VICTOR.DEV`. */
function playerName(context: Ctx, name: string, x: number, y: number, maxWidth: number) {
  let size = 78;
  context.font = display(size, 700);
  while (size > 40 && context.measureText(name).width > maxWidth) {
    size -= 2;
    context.font = display(size, 700);
  }
  const value = crop(context, name, maxWidth, display(size, 700));
  let cursor = x;
  for (const part of value.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu) ?? []) {
    const lit = !/[\p{L}\p{N}]/u.test(part) && part !== '…';
    cursor += write(context, part, cursor, y, display(size, 700), lit ? NEON : INK.white);
  }
}

async function profile(context: Ctx, identity: DiscordIdentityDto, team: TeamResponse) {
  const cx = 128;
  const cy = 176;
  const r = 78;
  glow(context, cx, cy, r * 1.9, NEON, 0.35);
  context.beginPath();
  context.arc(cx, cy, r + 10, 0, Math.PI * 2);
  context.strokeStyle = alpha(NEON, 0.35);
  context.lineWidth = 2;
  context.stroke();
  context.beginPath();
  context.arc(cx, cy, r + 4, 0, Math.PI * 2);
  context.strokeStyle = NEON;
  context.lineWidth = 5;
  context.stroke();

  const image = identity.avatarUrl ? await remoteImage(identity.avatarUrl) : undefined;
  context.save();
  context.beginPath();
  context.arc(cx, cy, r, 0, Math.PI * 2);
  context.fillStyle = '#16211b';
  context.fill();
  context.clip();
  if (image) context.drawImage(image, cx - r, cy - r, r * 2, r * 2);
  else
    write(
      context,
      identity.name.slice(0, 1).toUpperCase(),
      cx,
      cy + 3,
      display(r, 700),
      INK.white,
      'center',
    );
  context.restore();

  const bx = cx + r * 0.72;
  const by = cy + r * 0.72;
  context.beginPath();
  context.arc(bx, by, 19, 0, Math.PI * 2);
  context.fillStyle = BG;
  context.fill();
  context.strokeStyle = NEON;
  context.lineWidth = 2.5;
  context.stroke();
  fit(context, String(team.profile.level), bx, by + 1, 28, 22, INK.white, 'center');

  write(context, 'JOGADOR', 256, 108, mono(13, 600), NEON, 'left', 3);
  playerName(context, identity.name.toUpperCase(), 254, 150, 520);
  write(context, `NÍVEL ${team.profile.level}`, 258, 206, mono(15, 700), NEON, 'left', 2.5);
  write(
    context,
    `${fmt(team.profile.xp)} / ${fmt(team.profile.nextLevelXp)} XP`,
    766,
    206,
    mono(12),
    INK.body,
    'right',
    1,
  );
  const ratio = team.profile.nextLevelXp > 0 ? team.profile.xp / team.profile.nextLevelXp : 1;
  bar(context, 258, 222, 508, 13, ratio, NEON);
}

function profit(context: Ctx, team: TeamResponse): void {
  const ready = !team.profit.availableAt;
  const accent = ready ? NEON : GOLD;
  const x = 806;
  const y = 96;
  const w = RIGHT - x;
  const h = 156;
  glow(context, x + w / 2, y + h / 2, w * 0.7, accent, 0.12);
  box(context, x, y, w, h, 14);
  context.fillStyle = gradient(context, x, y, x + w, y + h, [
    [0, alpha(accent, 0.16)],
    [0.5, 'rgba(14, 14, 10, 0.94)'],
    [1, 'rgba(10, 9, 6, 0.96)'],
  ]);
  context.fill();
  context.strokeStyle = alpha(accent, 0.75);
  context.lineWidth = 1.8;
  context.stroke();

  const gold = ['#f1c453', '#b47a12', '#5e3c06'] as const;
  coinStack(context, x + 42, y + 118, 7, 21, gold);
  coinStack(context, x + 76, y + 92, 9, 22, gold);
  coinStack(context, x + 50, y + 132, 3, 20, gold);
  bigCoin(context, x + 86, y + 112, 24);

  write(context, 'LUCRO', x + 128, y + 34, mono(12, 500), INK.body, 'left', 3);
  fit(
    context,
    ready ? 'DISPONÍVEL' : 'EM ESPERA',
    x + 126,
    y + 76,
    w - 148,
    56,
    ready ? NEON : INK.white,
  );
  clock(context, x + 138, y + 120, accent);
  write(
    context,
    crop(
      context,
      ready ? 'Resgate pelo botão' : `Libera ${relative(team.profit.availableAt)}`,
      w - 176,
      ui(16, 500),
    ),
    x + 156,
    y + 121,
    ui(16, 500),
    INK.white,
  );
}

type Tile = Readonly<{
  label: string;
  value: string;
  caption: string;
  icon: Icon;
  accent: string;
  number?: string;
  art: (context: Ctx, x: number, y: number, w: number, h: number) => void;
}>;

function tile(context: Ctx, x: number, y: number, w: number, h: number, item: Tile): void {
  raised(context, x, y, w, h, item.accent === NEON ? undefined : item.accent);
  context.save();
  box(context, x, y, w, h, 14);
  context.clip();
  item.art(context, x, y, w, h);
  context.fillStyle = gradient(context, x, 0, x + w * 0.75, 0, [
    [0, 'rgba(10, 15, 12, 0.75)'],
    [0.55, 'rgba(10, 15, 12, 0.35)'],
    [1, 'rgba(10, 15, 12, 0)'],
  ]);
  context.fillRect(x, y, w, h);
  context.restore();

  badge(context, x + 40, y + 38, item.accent);
  item.icon(context, x + 40, y + 38, item.accent);
  write(context, item.label.toUpperCase(), x + 74, y + 39, mono(13, 500), INK.body, 'left', 2);
  chevron(context, x + w - 22, y + 24);
  fit(context, item.value, x + 24, y + 92, w * 0.62, 66, item.number ?? INK.white);
  write(context, crop(context, item.caption, w - 48, ui(16)), x + 26, y + 138, ui(16), INK.white);
}

function tiles(context: Ctx, team: TeamResponse): void {
  const packs = team.packs.reduce((total, item) => total + item.quantity, 0);
  const slots = team.formation.slots.length || 11;
  const green = ['#1c5a36', '#0f3520', '#061a0f'] as const;
  const items: Tile[] = [
    {
      label: 'Saldo',
      value: fmt(team.balance),
      caption: 'moedas',
      icon: coinsIcon,
      accent: NEON,
      art: (ctx, x, y) => {
        coinStack(ctx, x + 246, y + 104, 6, 18, green);
        coinStack(ctx, x + 212, y + 132, 7, 21, green);
        coinStack(ctx, x + 250, y + 150, 3, 18, green);
      },
    },
    {
      label: 'Elenco',
      value: fmt(team.inventoryCount),
      caption: team.inventoryCount === 1 ? 'jogador' : 'jogadores',
      icon: peopleIcon,
      accent: NEON,
      art: (ctx, x, y, w, h) => crowd(ctx, x + w * 0.7, y + h + 4, 'rgba(30, 44, 37, 0.9)'),
    },
    {
      label: 'Packs',
      value: fmt(packs),
      caption: packs ? 'para abrir' : 'nenhum fechado',
      icon: cardsIcon,
      accent: packs ? GOLD : NEON,
      number: packs ? GOLD : undefined,
      art: (ctx, x, y, w, h) => pack(ctx, x + w * 0.74, y + h * 0.56, 86, 124, packs > 0),
    },
    {
      label: 'Força',
      value: fmt(team.strength),
      caption: `${team.formation.name} · ${team.lineup.length}/${slots}`,
      icon: strengthIcon,
      accent: NEON,
      art: (ctx, x, y, w) => pitch(ctx, x + w * 0.56, y + 22, w * 0.44, 124, team),
    },
  ];
  const gap = 16;
  const w = (RIGHT - MARGIN - gap * 3) / 4;
  items.forEach((item, index) => tile(context, MARGIN + index * (w + gap), 276, w, 162, item));
}

function league(context: Ctx, state: LeaguePanelState | null): void {
  const x = MARGIN;
  const y = 454;
  const w = 590;
  const h = 186;
  raised(context, x, y, w, h);
  if (!state) {
    shield(context, x + 82, y + h / 2, 102, 130, '#5b5f63');
    write(context, 'LIGA', x + 154, y + 34, mono(13, 500), INK.body, 'left', 3);
    write(context, 'Indisponível agora', x + 154, y + 90, ui(20, 600), INK.white);
    write(context, 'Tente atualizar em instantes.', x + 154, y + 120, ui(14), INK.mute);
    return;
  }
  const { status } = state;
  const color = status.division.color ?? '#cd7f32';
  shield(context, x + 82, y + h / 2, 102, 130, color);
  write(context, 'LIGA', x + 154, y + 34, mono(13, 500), INK.body, 'left', 3);
  fit(context, status.division.name.toUpperCase(), x + 152, y + 74, 200, 58, INK.white);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x + 154, y + 108, 190, 1);

  const record: [string, number, string][] = [
    ['V', status.wins, NEON],
    ['E', status.draws, GOLD],
    ['D', status.losses, '#ef4444'],
  ];
  record.forEach(([label, value, tone], index) => {
    const cx = x + 162 + index * 74;
    const width = write(context, fmt(value), cx, y + 146, display(44, 700), tone);
    write(context, label, cx + width + 10, y + 148, mono(13, 600), INK.body);
    if (index > 0) {
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(cx - 16, y + 128, 1, 38);
    }
  });

  const points = `${fmt(status.points)} PTS`;
  context.font = display(42, 700);
  const pw = context.measureText(points).width + 70;
  const px = x + w - 38 - pw;
  box(context, px, y + 30, pw, 46, 10);
  context.fillStyle = 'rgba(0,0,0,0.3)';
  context.fill();
  trophy(context, px + 24, y + 52, GOLD);
  write(context, points, px + 46, y + 55, display(42, 700), GOLD);
  chevron(context, x + w - 20, y + 53);

  const qx = x + 372;
  const qy = y + 100;
  const qw = w - 392;
  box(context, qx, qy, qw, 62, 10);
  context.fillStyle = 'rgba(0,0,0,0.3)';
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.08)';
  context.lineWidth = 1;
  context.stroke();
  if (status.queue?.kind === 'waiting') {
    spinner(context, qx + 30, qy + 31, 13, BLUE);
    write(context, 'PROCURANDO', qx + 56, qy + 23, mono(12, 600), BLUE, 'left', 2);
    write(context, 'ADVERSÁRIO…', qx + 56, qy + 41, mono(12, 600), BLUE, 'left', 2);
  } else {
    context.beginPath();
    context.arc(qx + 30, qy + 31, 13, 0, Math.PI * 2);
    context.strokeStyle = alpha(NEON, 0.5);
    context.lineWidth = 2;
    context.stroke();
    context.beginPath();
    context.moveTo(qx + 26, qy + 24);
    context.lineTo(qx + 36, qy + 31);
    context.lineTo(qx + 26, qy + 38);
    context.closePath();
    context.fillStyle = NEON;
    context.fill();
    write(context, 'FORA DA', qx + 56, qy + 23, mono(12, 600), INK.body, 'left', 2);
    write(context, 'FILA', qx + 56, qy + 41, mono(12, 600), INK.body, 'left', 2);
  }
}

function missionsPanel(context: Ctx, missions: MissionsResponse | null): void {
  const x = MARGIN + 606;
  const y = 454;
  const w = RIGHT - x;
  const h = 186;
  raised(context, x, y, w, h);
  context.save();
  box(context, x, y, w, h, 14);
  context.clip();
  context.strokeStyle = 'rgba(255,255,255,0.03)';
  context.lineWidth = 2;
  context.strokeRect(x - 40, y + 50, 120, 150);
  context.strokeRect(x + w - 80, y + 40, 140, 160);
  context.restore();

  clipboardIcon(context, x + 32, y + 33, INK.body);
  write(context, 'MISSÕES', x + 52, y + 34, mono(13, 500), INK.body, 'left', 3);

  const list = missions?.missions ?? [];
  if (list.length === 0) {
    const cx = x + w / 2;
    tactics(context, cx, y + 72);
    write(
      context,
      missions ? 'Nenhuma missão ativa' : 'Indisponível agora',
      cx,
      y + 134,
      ui(19, 600),
      INK.white,
      'center',
    );
    const lines = missions
      ? ['Conclua missões para ganhar recompensas', 'e evoluir no FutHub.']
      : ['Tente atualizar em instantes.'];
    lines.forEach((line, index) =>
      write(context, line, cx, y + 158 + index * 16, ui(13), INK.mute, 'center'),
    );
    return;
  }

  tactics(context, x + w - 70, y + 70);
  const done = list.filter((mission) => mission.completed || mission.claimed).length;
  const count = `${done}/${list.length}`;
  const width = write(
    context,
    count,
    x + 28,
    y + 82,
    display(60, 700),
    done === list.length ? NEON : INK.white,
  );
  write(context, 'concluídas', x + 40 + width, y + 90, ui(17), INK.body);
  const next = list
    .filter((mission) => !mission.completed && !mission.claimed)
    .sort(
      (left, right) =>
        right.progress / Math.max(1, right.goal) - left.progress / Math.max(1, left.goal),
    )[0];
  if (next) {
    write(
      context,
      crop(context, next.title, w - 140, ui(16, 600)),
      x + 28,
      y + 134,
      ui(16, 600),
      INK.white,
    );
    write(
      context,
      `${next.progress}/${next.goal}`,
      x + w - 28,
      y + 134,
      mono(13, 600),
      INK.body,
      'right',
    );
    bar(context, x + 28, y + 154, w - 56, 10, next.progress / Math.max(1, next.goal), NEON);
  } else write(context, 'Todas concluídas!', x + 28, y + 140, ui(18, 600), NEON);
}

export async function hubImage({
  identity,
  team,
  league: state,
  missions,
}: HubLook): Promise<Buffer> {
  const { canvas: target, context } = canvas();
  backdrop(context, (scene) => silhouette(scene, 700, 12));
  masthead(context, 'Início', undefined, NEON, home);
  pill(context, `NÍVEL ${team.profile.level}`, 88);
  const ratio = team.profile.nextLevelXp > 0 ? team.profile.xp / team.profile.nextLevelXp : 1;
  bar(context, RIGHT - 90, 44, 72, 5, ratio, NEON);
  await profile(context, identity, team);
  profit(context, team);
  tiles(context, team);
  league(context, state);
  missionsPanel(context, missions);
  return png(target);
}
