import { createCanvas } from '@napi-rs/canvas';
import type { Image, SKRSContext2D } from '@napi-rs/canvas';

import { drawClubImage } from './club-image.js';
import { imageFont } from './image-fonts.js';
import { remoteImage } from './remote-image.js';
import type { TeamCard, TeamResponse, TeamSession, TeamTab } from './team-session.js';

export const teamImageName = 'futhub-team.png';

export type TeamImageTab = Exclude<TeamTab, 'league'>;
type TeamImageData = Pick<TeamSession, 'identity' | 'team'> &
  Readonly<{ tab: TeamImageTab }> &
  Partial<Pick<TeamSession, 'club' | 'league'>>;

const WIDTH = 1_200;
const OUTPUT_SCALE = 2;
const COMPACT_HEIGHT = 675;
const LINEUP_HEIGHT = 820;
const CARD_WIDTH = 108;
const CARD_HEIGHT = 144;
const BACKGROUND = '#111111';
const INK = '#f5f5f5';
const WHITE = '#ffffff';
const CLOUD = '#242424';
const MUTE = '#9e9ea0';
const HAIRLINE = '#4b4b4d';
const SALE = '#d30005';
const READY = '#2fbf71';
const titles: Record<TeamImageTab, string> = {
  overview: 'VISÃO GERAL',
  lineup: 'ESCALAÇÃO',
  inventory: 'ELENCO',
  packs: 'PACKS',
  sale: 'VENDA',
  club: 'CLUBE',
};
const tacticTitles: Record<TeamResponse['tactic'], string> = {
  defensive: 'DEFENSIVA',
  balanced: 'EQUILIBRADA',
  offensive: 'OFENSIVA',
};
async function loadPlayerImages(session: TeamImageData): Promise<Map<string, Image>> {
  const cards =
    session.tab === 'club' || session.tab === 'packs' || session.tab === 'overview'
      ? []
      : session.tab === 'lineup'
        ? session.team.lineup
        : session.team.inventory.items;
  const entries = await Promise.all(
    cards.map(
      async (card) =>
        [card.userCardId, card.imageUrl ? await remoteImage(card.imageUrl) : undefined] as const,
    ),
  );
  return new Map(entries.filter((entry): entry is readonly [string, Image] => Boolean(entry[1])));
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function contain(
  context: SKRSContext2D,
  image: Image,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.min(width / image.width, height / image.height);
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  context.drawImage(
    image,
    x + (width - drawnWidth) / 2,
    y + (height - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  );
}

function text(
  context: SKRSContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color = INK,
  align: 'left' | 'center' | 'right' = 'left',
  weight = 700,
): void {
  context.font = `${weight} ${size}px ${imageFont}`;
  context.textAlign = align;
  context.textBaseline = 'middle';
  context.fillStyle = color;
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

function header(context: SKRSContext2D, session: TeamImageData, height: number): void {
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, WIDTH, height);
  context.fillStyle = INK;
  context.fillRect(40, 28, 124, 34);
  text(context, 'FUTHUB', 102, 46, 15, BACKGROUND, 'center', 900);
  text(context, `MEU TIME / ${titles[session.tab]}`, 40, 108, 43, INK, 'left', 900);
  text(context, crop(context, session.identity.name, 300, 15), 1_160, 44, 15, MUTE, 'right', 600);
  text(
    context,
    session.tab === 'club'
      ? `ESTÁDIO NÍVEL ${session.club?.stadium.level ?? '-'}`
      : session.tab === 'overview'
        ? `NÍVEL ${session.team.profile.level}`
        : session.team.formation.name,
    1_160,
    103,
    18,
    INK,
    'right',
    900,
  );
  context.fillStyle = INK;
  context.fillRect(40, 142, 1_120, 2);
}

function pitch(context: SKRSContext2D, x: number, y: number, width: number, height: number): void {
  context.fillStyle = CLOUD;
  context.fillRect(x, y, width, height);
  context.strokeStyle = HAIRLINE;
  context.lineWidth = 2;
  context.strokeRect(x, y, width, height);
  context.beginPath();
  context.moveTo(x, y + height / 2);
  context.lineTo(x + width, y + height / 2);
  context.stroke();
  context.beginPath();
  context.arc(x + width / 2, y + height / 2, Math.min(width, height) * 0.13, 0, Math.PI * 2);
  context.stroke();
  context.strokeRect(x + width * 0.25, y, width * 0.5, height * 0.14);
  context.strokeRect(x + width * 0.25, y + height * 0.86, width * 0.5, height * 0.14);
}

function player(
  context: SKRSContext2D,
  card: TeamCard | undefined,
  position: string,
  x: number,
  y: number,
  image?: Image,
  tilt = 0,
): void {
  if (card && image) {
    context.fillStyle = 'rgba(0, 0, 0, 0.42)';
    context.beginPath();
    context.ellipse(x, y + CARD_HEIGHT / 2 + 8, CARD_WIDTH * 0.42, 9, 0, 0, Math.PI * 2);
    context.fill();

    context.save();
    context.translate(x, y);
    context.transform(1, tilt * 0.08, -tilt * 0.035, 1, 0, 0);
    context.shadowColor = 'rgba(0, 0, 0, 0.68)';
    context.shadowBlur = 14;
    context.shadowOffsetX = tilt * 7;
    context.shadowOffsetY = 9;
    contain(context, image, -CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);
    context.shadowColor = 'transparent';
    context.fillStyle = 'rgba(7, 12, 19, 0.94)';
    context.beginPath();
    context.roundRect(-CARD_WIDTH / 2 + 4, 10, CARD_WIDTH - 8, CARD_HEIGHT / 2 - 14, 6);
    context.fill();
    text(context, crop(context, card.name, CARD_WIDTH - 16, 10), 0, 31, 10, WHITE, 'center', 900);
    text(
      context,
      crop(context, card.collection.name, CARD_WIDTH - 16, 7),
      0,
      50,
      7,
      MUTE,
      'center',
      700,
    );
    context.restore();

    if (card.captain) {
      context.fillStyle = '#007d48';
      context.beginPath();
      context.arc(x - 44, y - 58, 10, 0, Math.PI * 2);
      context.fill();
      text(context, 'C', x - 44, y - 58, 9, WHITE, 'center', 900);
    }
    return;
  }

  context.fillStyle = card ? '#39393b' : BACKGROUND;
  context.beginPath();
  context.arc(x, y, 26, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = INK;
  context.lineWidth = 2;
  context.stroke();
  text(context, card ? initials(card.name) : position, x, y, card ? 14 : 10, INK, 'center', 900);
}

function lineupPitch(
  context: SKRSContext2D,
  team: TeamResponse,
  images: ReadonlyMap<string, Image>,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  pitch(context, x, y, width, height);
  const players = [...team.lineup];
  const slotRows = [...new Set(team.formation.slots.map(({ y: slotY }) => slotY))].sort(
    (left, right) => left - right,
  );
  const rowByY = new Map<number, number>();
  let rowCount = 0;
  for (const [index, slotY] of slotRows.entries()) {
    if (index === 0 || slotY - (slotRows[index - 1] ?? slotY) > 12) rowCount++;
    rowByY.set(slotY, rowCount - 1);
  }
  for (const slot of team.formation.slots) {
    const index = players.findIndex(({ holderPosition }) => holderPosition === slot.position);
    const card = index >= 0 ? players.splice(index, 1)[0] : undefined;
    const row = rowByY.get(slot.y) ?? 0;
    const rowPosition = rowCount === 1 ? slot.y / 100 : row / (rowCount - 1);
    player(
      context,
      card,
      slot.position,
      x + CARD_WIDTH / 2 + (slot.x / 100) * (width - CARD_WIDTH),
      y + CARD_HEIGHT / 2 + rowPosition * (height - CARD_HEIGHT),
      card ? images.get(card.userCardId) : undefined,
      Math.max(-1, Math.min(1, (slot.x - 50) / 40)),
    );
  }
}

function fit(context: SKRSContext2D, value: string, maxWidth: number, size: number): number {
  context.font = `900 ${size}px ${imageFont}`;
  const width = context.measureText(value).width;
  return width <= maxWidth ? size : Math.max(18, Math.floor((size * maxWidth) / width));
}

function remaining(availableAt: string, now: number): string {
  const minutes = Math.max(1, Math.ceil((new Date(availableAt).getTime() - now) / 60_000));
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes} MIN`;
  return minutes % 60 ? `${hours}H ${minutes % 60}MIN` : `${hours}H`;
}

function overview(
  context: SKRSContext2D,
  team: TeamResponse,
  league: TeamSession['league'] | undefined,
  now: number,
): void {
  const width = 357;
  const top = 176;
  const height = 459;
  const columns = [40, 421, 802] as const;
  for (const x of columns) {
    context.fillStyle = CLOUD;
    context.fillRect(x, top, width, height);
  }

  const [clubX, leagueX, rewardX] = [columns[0] + 28, columns[1] + 28, columns[2] + 28];
  const inner = width - 56;
  const balance = team.balance.toLocaleString('pt-BR');
  text(context, 'SALDO', clubX, 212, 14, MUTE, 'left', 700);
  text(context, balance, clubX, 270, fit(context, balance, inner, 64), INK, 'left', 900);
  text(context, 'MOEDAS', clubX, 318, 13, MUTE, 'left', 700);
  context.fillStyle = HAIRLINE;
  context.fillRect(clubX, 352, inner, 1);
  text(context, `NÍVEL ${team.profile.level}`, clubX, 394, 28, INK, 'left', 900);
  context.fillStyle = BACKGROUND;
  context.fillRect(clubX, 426, inner, 10);
  context.fillStyle = INK;
  context.fillRect(
    clubX,
    426,
    Math.round(inner * Math.min(1, team.profile.xp / team.profile.nextLevelXp)),
    10,
  );
  text(
    context,
    `${team.profile.xp}/${team.profile.nextLevelXp} XP`,
    clubX,
    458,
    12,
    MUTE,
    'left',
    700,
  );
  const packCount = team.packs.reduce((total, pack) => total + pack.quantity, 0);
  text(context, String(team.inventoryCount), clubX, 530, 36, INK, 'left', 900);
  text(context, 'JOGADORES', clubX, 566, 12, MUTE, 'left', 700);
  text(context, String(packCount), clubX + inner / 2, 530, 36, INK, 'left', 900);
  text(context, 'PACKS', clubX + inner / 2, 566, 12, MUTE, 'left', 700);

  text(context, 'LIGA', leagueX, 212, 14, MUTE, 'left', 700);
  if (league) {
    const { status } = league;
    const division = status.division.name.toUpperCase();
    text(context, crop(context, division, inner, 46), leagueX, 266, 46, INK, 'left', 900);
    text(
      context,
      `${status.points.toLocaleString('pt-BR')} PONTOS`,
      leagueX,
      318,
      18,
      INK,
      'left',
      700,
    );
    context.fillStyle = HAIRLINE;
    context.fillRect(leagueX, 352, inner, 1);
    const record = [
      ['V', status.wins],
      ['E', status.draws],
      ['D', status.losses],
    ] as const;
    record.forEach(([label, value], index) => {
      const x = leagueX + (index * inner) / 3;
      text(context, String(value), x, 410, 40, INK, 'left', 900);
      text(context, label, x, 448, 12, MUTE, 'left', 700);
    });
    const queue =
      status.queue?.kind === 'waiting'
        ? 'BUSCANDO ADVERSÁRIO'
        : league.match
          ? 'ÚLTIMA PARTIDA'
          : 'PRONTO PARA JOGAR';
    text(context, queue, leagueX, 530, 13, MUTE, 'left', 700);
    if (league.match && status.queue?.kind !== 'waiting') {
      const match = league.match;
      const score = `${match.homeGoals} × ${match.awayGoals}`;
      text(context, score, leagueX, 566, 24, INK, 'left', 900);
    }
  } else text(context, 'INDISPONÍVEL', leagueX, 266, 30, MUTE, 'left', 900);

  text(context, 'RECOMPENSAS', rewardX, 212, 14, MUTE, 'left', 700);
  text(context, 'LUCRO', rewardX, 266, 30, INK, 'left', 900);
  if (team.profit.availableAt) {
    text(context, 'EM ESPERA', rewardX, 330, 36, MUTE, 'left', 900);
    text(
      context,
      `LIBERA EM ${remaining(team.profit.availableAt, now)}`,
      rewardX,
      372,
      14,
      MUTE,
      'left',
      700,
    );
  } else {
    text(context, 'DISPONÍVEL', rewardX, 330, 36, READY, 'left', 900);
    text(context, 'USE /LUCRO PARA RESGATAR', rewardX, 372, 14, INK, 'left', 700);
  }
}

function lineup(
  context: SKRSContext2D,
  team: TeamResponse,
  images: ReadonlyMap<string, Image>,
): void {
  lineupPitch(context, team, images, 40, 176, 770, 604);
  context.fillStyle = CLOUD;
  context.fillRect(842, 176, 318, 604);
  text(context, 'FORMAÇÃO', 870, 214, 12, MUTE, 'left', 700);
  text(context, team.formation.name, 870, 264, 52, INK, 'left', 900);
  text(context, 'TÁTICA', 870, 328, 12, MUTE, 'left', 700);
  text(context, tacticTitles[team.tactic], 870, 366, 23, INK, 'left', 900);
  text(context, 'FORÇA', 870, 430, 12, MUTE, 'left', 700);
  text(context, String(team.strength), 870, 470, 36, INK, 'left', 900);
  const captain = team.lineup.find(({ captain }) => captain)?.name ?? 'Não definido';
  text(context, 'CAPITÃO', 870, 536, 12, MUTE, 'left', 700);
  text(context, crop(context, captain, 260, 20), 870, 574, 20, INK, 'left', 900);
  text(context, `${team.lineup.length}/11 TITULARES`, 870, 614, 12, MUTE, 'left', 700);
}

function inventory(
  context: SKRSContext2D,
  team: TeamResponse,
  images: ReadonlyMap<string, Image>,
  sale: boolean,
): void {
  const items = team.inventory.items.slice(0, 10);
  text(
    context,
    `${team.inventory.total} JOGADORES · PÁGINA ${team.inventory.page}/${Math.max(1, team.inventory.totalPages)}`,
    40,
    165,
    13,
    MUTE,
    'left',
    600,
  );
  if (items.length === 0) {
    context.fillStyle = CLOUD;
    context.fillRect(40, 194, 1_120, 410);
    text(context, 'NENHUM JOGADOR NESTA PÁGINA', 600, 400, 30, INK, 'center', 900);
    return;
  }
  items.forEach((card, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    const x = 40 + column * 226;
    const y = 190 + row * 224;
    context.fillStyle = CLOUD;
    context.fillRect(x, y, 208, 202);
    const image = images.get(card.userCardId);
    if (image) contain(context, image, x + 12, y, 184, 184);
    else text(context, initials(card.name), x + 104, y + 92, 46, '#cacacb', 'center', 900);
    if (card.favorite) text(context, '★', x + 190, y + 16, 18, INK, 'right', 900);
    text(context, card.holder ? 'TITULAR' : 'RESERVA', x + 8, y + 192, 10, MUTE, 'left', 700);
    if (sale)
      text(
        context,
        `${card.sellPrice.toLocaleString('pt-BR')} moedas`,
        x + 200,
        y + 192,
        10,
        SALE,
        'right',
        700,
      );
  });
}

function packs(context: SKRSContext2D, team: TeamResponse): void {
  text(context, `${team.packs.length} TIPO(S) DE PACK`, 40, 165, 13, MUTE, 'left', 600);
  if (team.packs.length === 0) {
    context.fillStyle = CLOUD;
    context.fillRect(40, 194, 1_120, 410);
    text(context, 'VOCÊ NÃO POSSUI PACKS', 600, 400, 30, INK, 'center', 900);
    return;
  }
  team.packs.slice(0, 10).forEach((pack, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    const x = 40 + column * 226;
    const y = 190 + row * 224;
    context.fillStyle = CLOUD;
    context.fillRect(x, y, 208, 202);
    text(context, pack.emoji, x + 104, y + 72, 48, INK, 'center', 700);
    text(context, crop(context, pack.name, 176, 16), x + 104, y + 132, 16, INK, 'center', 900);
    text(context, `${pack.quantity}x`, x + 104, y + 166, 20, MUTE, 'center', 900);
  });
}

export async function renderTeamImage(session: TeamImageData, now = Date.now()): Promise<Buffer> {
  const images = await loadPlayerImages(session);
  const height =
    session.tab === 'lineup' || session.tab === 'club' ? LINEUP_HEIGHT : COMPACT_HEIGHT;
  const canvas = createCanvas(WIDTH * OUTPUT_SCALE, height * OUTPUT_SCALE);
  const context = canvas.getContext('2d');
  context.scale(OUTPUT_SCALE, OUTPUT_SCALE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  header(context, session, height);

  if (session.tab === 'overview') overview(context, session.team, session.league, now);
  else if (session.tab === 'lineup') lineup(context, session.team, images);
  else if (session.tab === 'club' && session.club) drawClubImage(context, session.club, WIDTH);
  else if (session.tab === 'packs') packs(context, session.team);
  else inventory(context, session.team, images, session.tab === 'sale');

  return canvas.toBuffer('image/png');
}
