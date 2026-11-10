import { createCanvas } from '@napi-rs/canvas';

import { fmt } from '../core/format.js';
import type {
  TeamCard,
  TeamResponse,
  TeamSession,
  TeamTab,
} from '../features/team/team-session.js';
import { cardArt } from './card-art.js';
import { drawClubImage, stadiumIcon } from './club-image.js';
import {
  type Ctx,
  H,
  INK,
  type Icon,
  W,
  alpha,
  backdrop,
  badge,
  bar,
  box,
  crop,
  display,
  fit,
  glow,
  gradient,
  masthead,
  mono,
  pill,
  raised,
  stat,
  ui,
  write,
} from './kit.js';
import type { TestMatch } from '../features/test-match.js';
import { CARD_RATIO, type CardFace, playerCard } from './player-card.js';
import { cardsIcon, coinsIcon, crowd, pack, peopleIcon, star, strengthIcon } from './props.js';
import { remoteImage } from './remote-image.js';
import { drawPackArt } from './store-packs-image.js';

export const teamImageName = 'futhub-team.png';

/** Início e Liga têm arte própria (`art/hub.ts` e `art/scenes.ts`). */
export type TeamImageTab = Exclude<TeamTab, 'league' | 'overview' | 'match'>;
type TeamImageData = Pick<TeamSession, 'identity' | 'team'> &
  Readonly<{ tab: TeamImageTab }> &
  Partial<Pick<TeamSession, 'club'>>;

const WIDTH = W;
const OUTPUT_SCALE = 2;
const COMPACT_HEIGHT = H;
const LINEUP_HEIGHT = 820;
const MARGIN = 34;
const RIGHT = WIDTH - MARGIN;
const NEON = INK.success;
const GOLD = INK.gold;
const LINEUP_CARD = 100;
const titles: Record<TeamImageTab, string> = {
  lineup: 'Escalação',
  inventory: 'Elenco',
  packs: 'Packs',
  sale: 'Venda',
  club: 'Clube',
};
const tacticTitles: Record<TeamResponse['tactic'], string> = {
  defensive: 'DEFENSIVA',
  balanced: 'EQUILIBRADA',
  offensive: 'OFENSIVA',
};

const pitchIcon: Icon = (context, x, y, color) => {
  context.strokeStyle = color;
  context.lineWidth = 1.6;
  box(context, x - 9, y - 7, 18, 14, 2);
  context.stroke();
  context.beginPath();
  context.moveTo(x, y - 7);
  context.lineTo(x, y + 7);
  context.stroke();
  context.beginPath();
  context.arc(x, y, 3, 0, Math.PI * 2);
  context.stroke();
};

const icons: Record<TeamImageTab, Icon> = {
  lineup: pitchIcon,
  inventory: peopleIcon,
  packs: cardsIcon,
  sale: coinsIcon,
  club: stadiumIcon,
};

/** Fundo de estádio em qualquer altura: o `backdrop` do kit esticado na vertical. */
function stage(context: Ctx, height: number): void {
  context.save();
  context.scale(1, height / H);
  backdrop(context);
  context.restore();
}

/** Ícone num círculo translúcido e rótulo mono, o topo de todo painel. */
function label(context: Ctx, x: number, y: number, value: string, icon: Icon, color = NEON) {
  badge(context, x + 18, y, color, 18);
  icon(context, x + 18, y, color);
  write(context, value.toUpperCase(), x + 46, y + 1, mono(12, 500), INK.body, 'left', 2);
}

/** Estado vazio de uma aba de grade: painel largo, ilustração apagada e uma frase. */
function empty(context: Ctx, title: string, caption: string, art: (context: Ctx) => void) {
  raised(context, MARGIN, 126, RIGHT - MARGIN, 518);
  art(context);
  write(context, title, WIDTH / 2, 430, display(56, 700), INK.white, 'center');
  write(context, caption, WIDTH / 2, 480, ui(18), INK.body, 'center');
}

/** Linha de apoio abaixo do cabeçalho: contagem grande à esquerda e detalhe mono à direita. */
function summary(context: Ctx, count: string, detail: string, right?: string) {
  const width = write(context, count, MARGIN + 4, 102, display(30, 700), INK.white);
  write(context, detail, MARGIN + 16 + width, 104, mono(12, 500), INK.body, 'left', 2);
  if (right) write(context, right, RIGHT, 104, mono(12, 500), INK.body, 'right', 2);
}

// ── Escalação ───────────────────────────────────────────────────────────────────────────

function turf(context: Ctx, x: number, y: number, w: number, h: number): void {
  box(context, x, y, w, h, 14);
  context.fillStyle = gradient(context, x, y, x, y + h, [
    [0, '#0a1a11'],
    [0.5, '#0c2014'],
    [1, '#07130c'],
  ]);
  context.fill();
  context.save();
  box(context, x, y, w, h, 14);
  context.clip();
  const stripes = 10;
  for (let index = 0; index < stripes; index += 2) {
    context.fillStyle = 'rgba(255,255,255,0.018)';
    context.fillRect(x, y + (index * h) / stripes, w, h / stripes);
  }
  glow(context, x + w / 2, y + h / 2, w * 0.55, NEON, 0.1);
  const inset = 18;
  const left = x + inset;
  const top = y + inset;
  const width = w - inset * 2;
  const height = h - inset * 2;
  context.strokeStyle = alpha(NEON, 0.24);
  context.lineWidth = 1.6;
  context.strokeRect(left, top, width, height);
  context.beginPath();
  context.moveTo(left, top + height / 2);
  context.lineTo(left + width, top + height / 2);
  context.stroke();
  context.beginPath();
  context.arc(left + width / 2, top + height / 2, Math.min(width, height) * 0.12, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(left + width / 2, top + height / 2, 3, 0, Math.PI * 2);
  context.fillStyle = alpha(NEON, 0.4);
  context.fill();
  for (const [edge, direction] of [
    [top, 1],
    [top + height, -1],
  ] as const) {
    context.strokeRect(left + width * 0.22, edge, width * 0.56, direction * height * 0.15);
    context.strokeRect(left + width * 0.37, edge, width * 0.26, direction * height * 0.06);
  }
  context.restore();
  box(context, x, y, w, h, 14);
  context.strokeStyle = alpha(NEON, 0.22);
  context.lineWidth = 1.5;
  context.stroke();
}

function vacancy(context: Ctx, position: string, x: number, y: number, w: number): void {
  const h = w * CARD_RATIO;
  const unit = w / LINEUP_CARD;
  box(context, x - w / 2, y - h / 2, w, h, 10);
  context.fillStyle = 'rgba(4, 10, 7, 0.7)';
  context.fill();
  context.setLineDash([5, 5]);
  context.strokeStyle = alpha(NEON, 0.35);
  context.lineWidth = 1.5;
  context.stroke();
  context.setLineDash([]);
  write(
    context,
    position,
    x,
    y - 6 * unit,
    display(32 * unit, 700),
    alpha(INK.white, 0.7),
    'center',
  );
  write(context, 'VAGO', x, y + 24 * unit, mono(10 * unit, 600), INK.mute, 'center', 2);
}

function captainMark(context: Ctx, x: number, y: number): void {
  glow(context, x, y, 22, GOLD, 0.5);
  context.beginPath();
  context.arc(x, y, 12, 0, Math.PI * 2);
  context.fillStyle = GOLD;
  context.fill();
  context.strokeStyle = INK.canvas;
  context.lineWidth = 2;
  context.stroke();
  write(context, 'C', x, y + 1, display(17, 700), INK.canvas, 'center');
}

type PitchSlot = Readonly<{ position: string; x: number; y: number }>;
type PitchCard = CardFace & Readonly<{ holderPosition: string | null; captain?: boolean }>;

/** Cartas nas vagas da formação; `slot.x`/`slot.y` (0–100) viram linhas e colunas no campo. */
async function lineupPitch(
  context: Ctx,
  slots: readonly PitchSlot[],
  cards: readonly PitchCard[],
  x: number,
  y: number,
  width: number,
  height: number,
  cardWidth = LINEUP_CARD,
): Promise<void> {
  const cardHeight = cardWidth * CARD_RATIO;
  const players = [...cards];
  const slotRows = [...new Set(slots.map(({ y: slotY }) => slotY))].sort(
    (left, right) => left - right,
  );
  const rowByY = new Map<number, number>();
  let rowCount = 0;
  for (const [index, slotY] of slotRows.entries()) {
    if (index === 0 || slotY - (slotRows[index - 1] ?? slotY) > 12) rowCount++;
    rowByY.set(slotY, rowCount - 1);
  }
  const placed = slots.map((slot) => {
    const index = players.findIndex(({ holderPosition }) => holderPosition === slot.position);
    const card = index >= 0 ? players.splice(index, 1)[0] : undefined;
    const row = rowByY.get(slot.y) ?? 0;
    const rowPosition = rowCount === 1 ? slot.y / 100 : row / (rowCount - 1);
    return {
      slot,
      card,
      cx: x + cardWidth / 2 + (slot.x / 100) * (width - cardWidth),
      cy: y + cardHeight / 2 + rowPosition * (height - cardHeight),
    };
  });
  await Promise.all(placed.map(({ card }) => cardArt(card?.imageUrl)));
  for (const { slot, card, cx, cy } of placed) {
    if (!card) vacancy(context, slot.position, cx, cy, cardWidth);
    else await playerCard(context, card, cx - cardWidth / 2, cy - cardHeight / 2, cardWidth);
  }
  for (const { card, cx, cy } of placed)
    if (card?.captain) captainMark(context, cx + cardWidth / 2 - 4, cy - cardHeight / 2 + 4);
}

function tactic(context: Ctx, current: TeamResponse['tactic'], x: number, y: number, w: number) {
  const options = Object.entries(tacticTitles) as [TeamResponse['tactic'], string][];
  const gap = 8;
  const width = (w - gap * 2) / 3;
  options.forEach(([key, title], index) => {
    const cx = x + index * (width + gap);
    const active = key === current;
    box(context, cx, y, width, 38, 8);
    context.fillStyle = active ? alpha(NEON, 0.16) : 'rgba(0,0,0,0.3)';
    context.fill();
    context.strokeStyle = active ? alpha(NEON, 0.7) : 'rgba(255,255,255,0.08)';
    context.lineWidth = active ? 1.5 : 1;
    context.stroke();
    fit(
      context,
      title,
      cx + width / 2,
      y + 20,
      width - 12,
      18,
      active ? NEON : INK.mute,
      'center',
      600,
    );
  });
}

async function lineup(context: Ctx, team: TeamResponse): Promise<void> {
  turf(context, MARGIN, 92, 782, 694);
  await lineupPitch(context, team.formation.slots, team.lineup, 50, 104, 750, 670);

  const x = 832;
  const w = RIGHT - x;
  raised(context, x, 92, w, 220);
  label(context, x + 18, 128, 'Formação', pitchIcon);
  fit(context, team.formation.name, x + 22, 188, w - 44, 80, INK.white, 'left', 700);
  write(context, 'TÁTICA', x + 22, 246, mono(11, 500), INK.mute, 'left', 2);
  tactic(context, team.tactic, x + 22, 262, w - 44);

  const average = team.lineup.length
    ? Math.round(team.lineup.reduce((sum, card) => sum + card.overall, 0) / team.lineup.length)
    : undefined;
  stat(
    context,
    x,
    328,
    w,
    150,
    'Força',
    fmt(team.strength),
    average === undefined ? 'Sem titulares' : `Média geral ${average}`,
    INK.white,
    strengthIcon,
  );

  const captain = team.lineup.find((card) => card.captain);
  raised(context, x, 494, w, 150, captain ? GOLD : undefined);
  badge(context, x + 36, 528, GOLD, 18);
  write(context, 'C', x + 36, 529, display(20, 700), GOLD, 'center');
  write(context, 'CAPITÃO', x + 64, 529, mono(12, 500), INK.body, 'left', 2);
  fit(
    context,
    captain ? captain.name.toUpperCase() : 'NÃO DEFINIDO',
    x + 22,
    584,
    w - 44,
    44,
    captain ? INK.white : INK.mute,
  );
  if (captain)
    write(
      context,
      crop(
        context,
        `${captain.overall} · ${captain.position} · ${captain.collection.name}`,
        w - 44,
        ui(15),
      ),
      x + 22,
      620,
      ui(15),
      INK.body,
    );

  const slots = team.formation.slots.length || 11;
  raised(context, x, 660, w, 126);
  label(context, x + 18, 694, 'Titulares', peopleIcon);
  write(
    context,
    `${team.lineup.length}/${slots === 0 ? 11 : slots}`,
    x + w - 22,
    694,
    display(30, 700),
    team.lineup.length >= slots ? NEON : INK.white,
    'right',
  );
  bar(context, x + 22, 742, w - 44, 12, team.lineup.length / slots, NEON);
}

/** As duas escalações da partida lado a lado: mandante à esquerda, visitante à direita. */
export async function renderMatchLineupsImage(match: TestMatch): Promise<Buffer> {
  const canvas = createCanvas(WIDTH * OUTPUT_SCALE, LINEUP_HEIGHT * OUTPUT_SCALE);
  const context = canvas.getContext('2d');
  context.scale(OUTPUT_SCALE, OUTPUT_SCALE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  stage(context, LINEUP_HEIGHT);
  masthead(context, 'Partida · Escalações', undefined, NEON, pitchIcon);

  const gap = 16;
  const w = (RIGHT - MARGIN - gap) / 2;
  const sides = [match.home, match.away] as const;
  for (const [index, team] of sides.entries()) {
    const x = MARGIN + index * (w + gap);
    fit(context, team.name.toUpperCase(), x + 4, 112, w - 220, 30, INK.white, 'left', 700);
    write(
      context,
      `${team.cpu ? 'BOT · ' : ''}FORÇA ${team.rating} · ${tacticTitles[team.tactic]}`,
      x + w - 4,
      114,
      mono(11, 500),
      INK.body,
      'right',
      2,
    );
    turf(context, x, 136, w, 650);
    await lineupPitch(
      context,
      team.slots,
      team.lineup.map((card) => ({ ...card, holderPosition: card.position })),
      x + 14,
      148,
      w - 28,
      626,
      86,
    );
  }
  return canvas.toBuffer('image/png');
}

// ── Elenco, venda e packs ───────────────────────────────────────────────────────────────

const GRID_TOP = 126;
const GRID_GAP = 16;
const GRID_WIDTH = (RIGHT - MARGIN - GRID_GAP * 4) / 5;

function gridCell(index: number, height: number): readonly [number, number] {
  return [
    MARGIN + (index % 5) * (GRID_WIDTH + GRID_GAP),
    GRID_TOP + Math.floor(index / 5) * (height + 14),
  ];
}

async function inventory(context: Ctx, team: TeamResponse, sale: boolean): Promise<void> {
  const items = team.inventory.items.slice(0, 10);
  summary(
    context,
    fmt(team.inventory.total),
    team.inventory.total === 1 ? 'JOGADOR' : 'JOGADORES',
    `PÁGINA ${team.inventory.page}/${Math.max(1, team.inventory.totalPages)}`,
  );
  if (items.length === 0) {
    const [title, hint] = sale
      ? ['NENHUM JOGADOR À VENDA', 'Titulares, favoritos e o capitão não podem ser vendidos.']
      : ['NENHUM JOGADOR NESTA PÁGINA', 'Abra packs ou contrate no mercado.'];
    empty(context, title, hint, (ctx) => crowd(ctx, WIDTH / 2, 360, 'rgba(30, 44, 37, 0.9)'));
    return;
  }
  await Promise.all(items.map((card) => cardArt(card.imageUrl)));
  const height = 252;
  const cardWidth = 134;
  for (const [index, card] of items.entries()) {
    const [x, y] = gridCell(index, height);
    await inventoryTile(context, card, x, y, height, cardWidth, sale);
  }
}

async function inventoryTile(
  context: Ctx,
  card: TeamCard,
  x: number,
  y: number,
  height: number,
  cardWidth: number,
  sale: boolean,
): Promise<void> {
  raised(context, x, y, GRID_WIDTH, height);
  await playerCard(context, card, x + (GRID_WIDTH - cardWidth) / 2, y + 12, cardWidth);
  if (card.favorite) {
    glow(context, x + GRID_WIDTH - 22, y + 24, 18, GOLD, 0.5);
    star(context, x + GRID_WIDTH - 22, y + 24, 10, GOLD);
  }
  const line = y + height - 25;
  context.fillStyle = 'rgba(255,255,255,0.08)';
  context.fillRect(x + 14, line - 18, GRID_WIDTH - 28, 1);
  const tone = card.holder ? NEON : INK.mute;
  context.beginPath();
  context.arc(x + 20, line, 3.5, 0, Math.PI * 2);
  context.fillStyle = tone;
  context.fill();
  write(
    context,
    card.holder ? 'TITULAR' : 'RESERVA',
    x + 30,
    line + 1,
    mono(11, 600),
    tone,
    'left',
    1.5,
  );
  if (sale) {
    const price = fmt(card.sellPrice);
    const width = write(
      context,
      price,
      x + GRID_WIDTH - 14,
      line + 1,
      display(22, 700),
      GOLD,
      'right',
    );
    coinsIcon(context, x + GRID_WIDTH - 26 - width, line + 1, GOLD);
  } else
    write(
      context,
      card.position,
      x + GRID_WIDTH - 14,
      line + 1,
      display(20, 600),
      INK.body,
      'right',
    );
}

/** Nome centrado que encolhe até `min` e depois corta, para não virar letra miúda. */
function name(context: Ctx, value: string, x: number, y: number, maxWidth: number, size: number) {
  let current = size;
  context.font = display(current, 600);
  while (current > 18 && context.measureText(value).width > maxWidth) {
    current -= 1;
    context.font = display(current, 600);
  }
  const font = display(current, 600);
  write(context, crop(context, value, maxWidth, font), x, y, font, INK.white, 'center');
}

async function packs(context: Ctx, team: TeamResponse): Promise<void> {
  const total = team.packs.reduce((sum, item) => sum + item.quantity, 0);
  summary(
    context,
    String(team.packs.length),
    team.packs.length === 1 ? 'TIPO DE PACK' : 'TIPOS DE PACK',
    total ? `${fmt(total)} PARA ABRIR` : undefined,
  );
  if (team.packs.length === 0) {
    empty(context, 'VOCÊ NÃO POSSUI PACKS', 'Compre na loja ou ganhe completando missões.', (ctx) =>
      pack(ctx, WIDTH / 2, 268, 96, 136, false),
    );
    return;
  }
  const shown = team.packs.slice(0, 10);
  const tall = shown.length <= 5;
  const height = tall ? 518 : 252;
  const scale = tall ? 2 : 1;
  const offset = tall ? ((5 - shown.length) * (GRID_WIDTH + GRID_GAP)) / 2 : 0;
  const images = await Promise.all(
    shown.map((item) => (item.imageUrl ? remoteImage(item.imageUrl) : undefined)),
  );
  // A arte publicada é 600 × 800; cabe na célula sem invadir o nome.
  const artScale = tall ? 0.31 : 0.15;
  shown.forEach((item, index) => {
    const image = images[index];
    const [cellX, y] = gridCell(index, height);
    const x = cellX + offset;
    const cx = x + GRID_WIDTH / 2;
    raised(context, x, y, GRID_WIDTH, height, GOLD);
    const artY = y + (tall ? 196 : 80);
    glow(context, cx, artY, 90 * scale, GOLD, 0.18);
    if (image)
      drawPackArt(
        context,
        { cardsAmount: item.cardsAmount, price: 0 },
        image,
        cx - 300 * artScale,
        artY - 400 * artScale,
        artScale,
      );
    else pack(context, cx, artY, 70 * scale, 100 * scale, true);
    const nameY = y + (tall ? 392 : 174);
    name(context, item.name.toUpperCase(), cx, nameY, GRID_WIDTH - 28, tall ? 32 : 24);
    const quantity = `×${fmt(item.quantity)}`;
    context.font = display(26, 700);
    const width = context.measureText(quantity).width + 30;
    const pillY = y + (tall ? 446 : 212);
    box(context, cx - width / 2, pillY - 16, width, 32, 16);
    context.fillStyle = GOLD;
    context.fill();
    write(context, quantity, cx, pillY + 1, display(26, 700), INK.canvas, 'center');
  });
  if (team.packs.length > shown.length)
    write(
      context,
      `+${team.packs.length - shown.length} tipos`,
      RIGHT,
      660,
      mono(11, 600),
      INK.mute,
      'right',
      2,
    );
}

// ── Montagem ────────────────────────────────────────────────────────────────────────────

function clubUnavailable(context: Ctx): void {
  raised(context, MARGIN, 92, RIGHT - MARGIN, 694);
  write(context, 'CLUBE INDISPONÍVEL', WIDTH / 2, 420, display(56, 700), INK.white, 'center');
  write(context, 'Tente atualizar em instantes.', WIDTH / 2, 470, ui(18), INK.body, 'center');
}

export async function renderTeamImage(session: TeamImageData): Promise<Buffer> {
  const height =
    session.tab === 'lineup' || session.tab === 'club' ? LINEUP_HEIGHT : COMPACT_HEIGHT;
  const canvas = createCanvas(WIDTH * OUTPUT_SCALE, height * OUTPUT_SCALE);
  const context = canvas.getContext('2d');
  context.scale(OUTPUT_SCALE, OUTPUT_SCALE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  stage(context, height);

  const { tab, team } = session;
  const accent = tab === 'packs' || tab === 'sale' ? GOLD : NEON;
  masthead(context, `Meu time · ${titles[tab]}`, undefined, accent, icons[tab]);
  pill(context, crop(context, session.identity.name.toUpperCase(), 240, mono(12, 600)), 0, accent);

  if (tab === 'lineup') await lineup(context, team);
  else if (tab === 'club') {
    if (session.club) drawClubImage(context, session.club, WIDTH);
    else clubUnavailable(context);
  } else if (tab === 'packs') await packs(context, team);
  else await inventory(context, team, tab === 'sale');

  return canvas.toBuffer('image/png');
}
