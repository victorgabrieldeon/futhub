import type {
  CompletedMissionDto,
  LucroResponse,
  MissionsResponse,
  PackCatalogItem,
} from '@futhub/api-client';

import { fmt, signed } from '../core/format.js';
import { rarity } from '../core/juice.js';
import type { LeaguePanelState } from '../features/team/team-session.js';
import type { MatchFrame, TestMatch } from '../features/test-match.js';
import {
  type Ctx,
  INK,
  W,
  alpha,
  badge,
  bar,
  box,
  canvas,
  crop,
  display,
  eyebrow,
  fit,
  frame,
  glow,
  gradient,
  heading,
  mono,
  png,
  raised,
  rays,
  stat,
  ui,
  write,
} from './kit.js';
import { CARD_RATIO, type CardFace, type Reveal, playerCard } from './player-card.js';
import {
  ballIcon,
  bigCoin,
  cardsIcon,
  check,
  clipboardIcon,
  coinStack,
  coinsIcon,
  giftIcon,
  pack as packProp,
  peopleIcon,
  shield,
  spinner,
  starIcon,
  strengthIcon,
  tactics,
  trophy,
} from './props.js';
import { remoteImage } from './remote-image.js';
import { drawPackArt } from './store-packs-image.js';

/** Pack como a arte precisa: o inventário só traz nome; a loja completa preço, cartas e arte. */
export type PackLook = Readonly<{
  name: string;
  price: number;
  cardsAmount: number;
  imageUrl: string | null;
}>;

/** Packs fora da loja (missões, códigos) não estão no catálogo: a arte vem do próprio pack. */
export function packLook(
  pack: Readonly<{ id: string; name: string; cardsAmount?: number; imageUrl?: string | null }>,
  catalog: readonly PackCatalogItem[],
): PackLook {
  const listed = catalog.find((item) => item.id === pack.id);
  return {
    name: pack.name,
    price: listed?.price ?? 0,
    cardsAmount: listed?.cardsAmount ?? pack.cardsAmount ?? 1,
    imageUrl: listed?.imageUrl || pack.imageUrl || null,
  };
}

async function packArt(context: Ctx, pack: PackLook, x: number, y: number, scale: number) {
  const image = pack.imageUrl ? await remoteImage(pack.imageUrl) : undefined;
  drawPackArt(context, pack, image, x, y, scale);
}

// ── Lucro ───────────────────────────────────────────────────────────────────────────────

type LucroSuccess = Extract<LucroResponse, { kind: 'success' }>;

const GOLD_COINS = ['#f1c453', '#b47a12', '#5e3c06'] as const;

/** `amount` permite os quadros do contador; o fechamento aparece só no quadro final. */
export function lucroImage(
  result: LucroSuccess,
  amount = result.reward.value,
  final = true,
): Buffer {
  const { canvas: target, context } = canvas();
  frame(context, 'Lucro', 'caixa do clube', INK.success, coinsIcon);
  const share = amount / Math.max(1, result.reward.value);
  glow(context, 300, 280, 380, INK.success, final ? 0.3 : 0.15 + share * 0.15);
  glow(context, 520, 290, 160, INK.gold, 0.12 + share * 0.12);
  coinStack(context, 486, 300, 9, 34, GOLD_COINS);
  coinStack(context, 556, 322, 6, 30, GOLD_COINS);
  coinStack(context, 470, 352, 3, 30, GOLD_COINS);
  bigCoin(context, 546, 340, 34);
  eyebrow(context, 'Lucro do dia', 40, 128);
  fit(context, `+${fmt(amount)}`, 36, 230, 410, 170, INK.white, 'left');
  write(context, 'MOEDAS', 42, 326, display(34, 600), INK.gold, 'left', 4);
  write(
    context,
    crop(context, result.reward.message, 400, ui(18, 500)),
    42,
    376,
    ui(18, 500),
    INK.body,
  );

  raised(context, 34, 428, 572, 212);
  badge(context, 70, 466, INK.success);
  coinsIcon(context, 70, 466, INK.success);
  write(context, 'SALDO', 104, 467, mono(13, 500), INK.body, 'left', 3);
  write(context, fmt(result.balance), 58, 538, display(68, 700), INK.white);
  const { progression } = result;
  write(
    context,
    `NÍVEL ${progression.level}  ·  +${progression.gainedXp} XP`,
    582,
    467,
    mono(12, 600),
    INK.success,
    'right',
    1,
  );
  bar(
    context,
    58,
    598,
    524,
    12,
    progression.xp / Math.max(1, progression.nextLevelXp),
    INK.success,
  );

  raised(context, 626, 96, 540, 544);
  badge(context, 662, 134, INK.success);
  clipboardIcon(context, 662, 134, INK.success);
  write(context, 'FECHAMENTO DO CLUBE', 696, 135, mono(13, 500), INK.body, 'left', 3);
  const { report } = result;
  const rows: [string, number][] = [
    ['Bilheteria', report.ticketRevenue],
    ['Receita comercial', report.commercialRevenue],
    ['Patrocinador', report.sponsorRevenue],
    ['Manutenção', -report.maintenance],
    ['Folha salarial', -report.payroll],
  ];
  const largest = Math.max(1, ...rows.map(([, value]) => Math.abs(value)));
  rows.forEach(([label, value], index) => {
    const y = 200 + index * 64;
    const tone = value >= 0 ? INK.success : INK.danger;
    context.globalAlpha = final ? 1 : 0.35;
    write(context, label, 652, y, ui(17, 500), INK.white);
    write(context, signed(value), 1_140, y, display(30, 700), tone, 'right');
    bar(context, 652, y + 22, 488, 8, Math.abs(value) / largest, tone);
    context.globalAlpha = 1;
  });
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(652, 540, 488, 1);
  write(context, 'LUCRO LÍQUIDO', 652, 586, mono(13, 600), INK.body, 'left', 3);
  write(
    context,
    signed(report.net),
    1_140,
    586,
    display(54, 700),
    report.net >= 0 ? INK.success : INK.danger,
    'right',
  );
  return png(target);
}

// ── Subida de nível ─────────────────────────────────────────────────────────────────────

const REWARD: Record<string, string> = {
  balance: 'moedas',
  card: 'carta',
  field: 'campo',
  pack: 'pack',
  premium: 'premium',
};

const REWARD_ICON: Record<string, typeof coinsIcon> = {
  balance: coinsIcon,
  card: peopleIcon,
  field: strengthIcon,
  pack: cardsIcon,
  premium: starIcon,
};

/** Recompensa em pílula dourada com ícone; devolve a largura. */
function rewardChip(
  context: Ctx,
  type: string,
  quantity: number,
  x: number,
  y: number,
  measure = false,
): number {
  const label = `+${fmt(quantity)} ${REWARD[type] ?? type}`.toUpperCase();
  context.font = display(34, 700);
  const width = context.measureText(label).width + 84;
  if (measure) return width;
  box(context, x, y - 30, width, 60, 30);
  context.fillStyle = 'rgba(10, 12, 8, 0.85)';
  context.fill();
  context.strokeStyle = alpha(INK.gold, 0.6);
  context.lineWidth = 1.5;
  context.stroke();
  badge(context, x + 32, y, INK.gold, 20);
  (REWARD_ICON[type] ?? starIcon)(context, x + 32, y, INK.gold);
  write(context, label, x + 62, y + 2, display(34, 700), INK.gold);
  return width;
}

export function levelUpImage(
  progression: Readonly<{
    level: number;
    rewards: readonly { type: string; quantity: number }[];
  }>,
): Buffer {
  const { canvas: target, context } = canvas();
  frame(context, 'Progressão', 'subiu de nível', INK.gold, starIcon);
  rays(context, W / 2, 310, INK.gold, 16, 900);
  glow(context, W / 2, 310, 360, INK.gold, 0.4);
  eyebrow(context, 'Novo nível', W / 2, 118, INK.gold, 'center');
  context.beginPath();
  context.arc(W / 2, 300, 140, 0, Math.PI * 2);
  context.strokeStyle = alpha(INK.gold, 0.3);
  context.lineWidth = 2;
  context.stroke();
  context.beginPath();
  context.arc(W / 2, 300, 128, 0, Math.PI * 2);
  context.fillStyle = gradient(context, 0, 172, 0, 428, [
    [0, 'rgba(40, 30, 8, 0.95)'],
    [1, 'rgba(10, 9, 5, 0.95)'],
  ]);
  context.fill();
  context.strokeStyle = INK.gold;
  context.lineWidth = 6;
  context.stroke();
  for (const angle of [-0.5, 0, 0.5]) {
    const a = -Math.PI / 2 + angle;
    starIcon(context, W / 2 + Math.cos(a) * 128, 300 + Math.sin(a) * 128, INK.gold);
  }
  fit(context, String(progression.level), W / 2, 288, 200, 150, INK.white, 'center');
  write(context, 'NÍVEL', W / 2, 382, mono(14, 600), INK.gold, 'center', 4);

  const rewards = progression.rewards.slice(0, 3);
  if (rewards.length === 0) {
    write(
      context,
      'Continue jogando para a próxima recompensa',
      W / 2,
      530,
      ui(20),
      INK.body,
      'center',
    );
    return png(target);
  }
  const gap = 18;
  const widths = rewards.map(({ type, quantity }) =>
    rewardChip(context, type, quantity, 0, 0, true),
  );
  let x = (W - widths.reduce((sum, width) => sum + width, 0) - gap * (rewards.length - 1)) / 2;
  for (const { type, quantity } of rewards) x += rewardChip(context, type, quantity, x, 530) + gap;
  return png(target);
}

// ── Packs ───────────────────────────────────────────────────────────────────────────────

export async function packOpeningImage(
  pack: PackLook,
  progress: number,
  shake: number,
  tint: string,
  hint: string,
): Promise<Buffer> {
  const { canvas: target, context } = canvas();
  frame(context, 'Abrindo pack', pack.name, tint, cardsIcon);
  glow(context, W / 2, 360, 340 + progress * 120, tint, 0.25 + progress * 0.3);
  if (progress > 0.5) rays(context, W / 2, 360, tint, 12, 700);
  const scale = 0.55;
  context.save();
  context.translate(W / 2, 340);
  context.rotate(shake);
  await packArt(context, pack, (-600 * scale) / 2, (-800 * scale) / 2, scale);
  context.restore();
  bar(context, 340, 626, 520, 12, progress, tint);
  write(context, hint.toUpperCase(), W / 2, 600, mono(12, 600), INK.body, 'center', 3);
  return png(target);
}

export async function walkoutImage(
  pack: PackLook,
  card: CardFace,
  reveal: Reveal,
  others: number,
): Promise<Buffer> {
  const { canvas: target, context } = canvas();
  const tier = rarity(card.overall);
  frame(context, 'Walkout', `Carta ${tier.label}`, tier.color, starIcon);
  rays(context, W / 2, 380, tier.color, 18, 900);
  glow(context, W / 2, 380, 420, tier.color, 0.55);
  const width = 300;
  await playerCard(context, card, W / 2 - width / 2, 120, width, reveal);
  write(
    context,
    crop(context, pack.name.toUpperCase(), 300, mono(12, 600)),
    60,
    600,
    mono(12, 600),
    INK.mute,
    'left',
    3,
  );
  write(context, tier.label.toUpperCase(), 60, 560, display(54, 700), tier.color, 'left', 2);
  if (others > 0 && reveal === 'full')
    write(
      context,
      `+${others} ${others === 1 ? 'CARTA' : 'CARTAS'}`,
      1_140,
      560,
      display(44, 700),
      INK.white,
      'right',
    );
  return png(target);
}

export async function packResultImage(pack: PackLook, cards: readonly CardFace[]): Promise<Buffer> {
  const { canvas: target, context } = canvas();
  const best = cards[0];
  const tint = best ? rarity(best.overall).color : INK.gold;
  frame(
    context,
    'Pack aberto',
    `${cards.length} ${cards.length === 1 ? 'carta' : 'cartas'}`,
    tint,
    cardsIcon,
  );
  glow(context, W / 2, 420, 520, tint, 0.18);
  const shown = cards.slice(0, 10);
  const perRow = shown.length <= 5 ? shown.length : Math.ceil(shown.length / 2);
  const rows = Math.ceil(shown.length / Math.max(1, perRow));
  const width = rows === 1 ? Math.min(250, (1_120 - (perRow - 1) * 20) / Math.max(1, perRow)) : 150;
  const height = width * CARD_RATIO;
  const top = rows === 1 ? 150 : 104;
  await Promise.all(
    shown.map((card, index) => {
      const rowIndex = Math.floor(index / perRow);
      const inRow = Math.min(perRow, shown.length - rowIndex * perRow);
      const rowWidth = inRow * width + (inRow - 1) * 20;
      const x = (W - rowWidth) / 2 + (index % perRow) * (width + 20);
      return playerCard(context, card, x, top + rowIndex * (height + 22), width);
    }),
  );
  if (rows === 1) {
    write(
      context,
      crop(context, pack.name.toUpperCase(), 700, display(40, 700)),
      40,
      112,
      display(40, 700),
      INK.white,
    );
    write(
      context,
      `${Math.round(cards.reduce((sum, card) => sum + card.overall, 0) / Math.max(1, cards.length))} DE MÉDIA`,
      1_160,
      112,
      mono(12, 600),
      INK.mute,
      'right',
      2,
    );
  }
  if (cards.length > shown.length)
    write(
      context,
      `+${cards.length - shown.length}`,
      1_160,
      640,
      display(36, 700),
      INK.white,
      'right',
    );
  return png(target);
}

export async function myPacksImage(
  packs: readonly (PackLook & { quantity: number })[],
): Promise<Buffer> {
  const { canvas: target, context } = canvas();
  const total = packs.reduce((sum, pack) => sum + pack.quantity, 0);
  frame(context, 'Meus packs', `${total} fechados`, INK.gold, cardsIcon);
  const top = heading(
    context,
    'Meus packs',
    total ? 'Clique em Abrir para revelar as cartas.' : undefined,
  );
  const shown = packs.slice(0, 4);
  if (shown.length === 0) {
    raised(context, 34, top + 10, 1_132, 450);
    packProp(context, W / 2, top + 150, 120, 170, false);
    write(context, 'NENHUM PACK FECHADO', W / 2, top + 310, display(56, 700), INK.white, 'center');
    write(
      context,
      'Compre na loja ou ganhe completando missões.',
      W / 2,
      top + 360,
      ui(18),
      INK.mute,
      'center',
    );
    return png(target);
  }
  const tile = 266;
  const start = (W - (shown.length * tile + (shown.length - 1) * 18)) / 2;
  for (const [index, pack] of shown.entries()) {
    const x = start + index * (tile + 18);
    raised(context, x, top + 10, tile, 450);
    await packArt(context, pack, x + (tile - 222) / 2, top + 24, 0.37);
    fit(context, pack.name.toUpperCase(), x + 18, top + 362, tile - 36, 34, INK.white, 'left', 600);
    box(context, x + 18, top + 396, 86, 40, 20);
    context.fillStyle = INK.gold;
    context.fill();
    write(context, `×${pack.quantity}`, x + 61, top + 417, display(28, 700), INK.canvas, 'center');
  }
  if (packs.length > shown.length)
    write(
      context,
      `+${packs.length - shown.length} tipos`,
      1_160,
      650,
      mono(12, 600),
      INK.mute,
      'right',
      2,
    );
  return png(target);
}

export async function purchaseImage(
  pack: PackLook,
  quantity: number,
  balance: number,
): Promise<Buffer> {
  const { canvas: target, context } = canvas();
  frame(context, 'Loja', 'compra confirmada', INK.success, cardsIcon);
  glow(context, 330, 380, 360, INK.gold, 0.35);
  await packArt(context, pack, 330 - 300 * 0.62, 380 - 400 * 0.62, 0.62);
  write(context, 'COMPRA CONFIRMADA', 660, 170, mono(14, 600), INK.success, 'left', 4);
  write(context, 'É SEU!', 656, 250, display(110, 700), INK.white, 'left', -2);
  fit(context, pack.name.toUpperCase(), 660, 330, 480, 46, INK.gold, 'left', 600);
  stat(
    context,
    660,
    380,
    230,
    140,
    'No inventário',
    `×${quantity}`,
    undefined,
    INK.white,
    cardsIcon,
  );
  stat(
    context,
    910,
    380,
    256,
    140,
    'Pago',
    `−${fmt(pack.price)}`,
    `saldo ${fmt(balance)}`,
    INK.danger,
    coinsIcon,
  );
  return png(target);
}

/** Detalhe de um pack na loja: a arte grande e o que ele entrega. */
export async function packShowcaseImage(pack: PackLook): Promise<Buffer> {
  const { canvas: target, context } = canvas();
  frame(context, 'Loja', 'detalhe do pack', INK.gold, cardsIcon);
  glow(context, 330, 380, 360, INK.gold, 0.3);
  await packArt(context, pack, 330 - 300 * 0.62, 380 - 400 * 0.62, 0.62);
  write(context, 'PACK DE CARTAS', 660, 170, mono(14, 600), INK.gold, 'left', 4);
  fit(context, pack.name.toUpperCase(), 656, 250, 500, 96, INK.white, 'left');
  stat(
    context,
    660,
    330,
    240,
    140,
    'Cartas',
    String(pack.cardsAmount),
    'por pack',
    INK.white,
    cardsIcon,
  );
  stat(context, 920, 330, 246, 140, 'Preço', fmt(pack.price), 'moedas', INK.gold, coinsIcon);
  write(context, 'As cartas vão direto para o seu elenco.', 660, 530, ui(18), INK.body);
  return png(target);
}

export async function hireImage(card: CardFace, price: number, balance: number): Promise<Buffer> {
  const { canvas: target, context } = canvas();
  const tier = rarity(card.overall);
  frame(context, 'Mercado', 'contratação fechada', tier.color, peopleIcon);
  rays(context, 300, 380, tier.color, 14, 420);
  glow(context, 300, 380, 360, tier.color, 0.45);
  await playerCard(context, card, 300 - 140, 380 - 196, 280);
  write(context, 'CONTRATAÇÃO FECHADA', 620, 170, mono(14, 600), tier.color, 'left', 4);
  fit(context, card.name.toUpperCase(), 616, 250, 540, 96, INK.white, 'left');
  write(
    context,
    `${card.overall} · ${card.position} · CARTA ${tier.label.toUpperCase()}`,
    620,
    316,
    display(30, 600),
    INK.body,
    'left',
    1,
  );
  stat(context, 620, 380, 260, 140, 'Pago', `−${fmt(price)}`, undefined, INK.danger, coinsIcon);
  stat(context, 900, 380, 266, 140, 'Saldo', fmt(balance), undefined, INK.white, coinsIcon);
  return png(target);
}

/** Vitrine do mercado: as cinco primeiras cartas da página como cartas de verdade. */
export async function marketImage(
  cards: readonly (CardFace & { price: number })[],
  total: number,
): Promise<Buffer> {
  const { canvas: target, context } = canvas();
  frame(context, 'Mercado', `${fmt(total)} jogadores`, INK.success, peopleIcon);
  const top = heading(context, 'Contratar', 'Escolha um jogador no menu abaixo.');
  const shown = cards.slice(0, 5);
  if (shown.length === 0) {
    write(
      context,
      'NENHUM JOGADOR COM ESTES FILTROS',
      W / 2,
      380,
      display(52, 600),
      INK.white,
      'center',
    );
    return png(target);
  }
  const width = 200;
  const start = (W - (shown.length * width + (shown.length - 1) * 24)) / 2;
  await Promise.all(
    shown.map(async (card, index) => {
      const x = start + index * (width + 24);
      await playerCard(context, card, x, top + 6, width);
      write(
        context,
        `${fmt(card.price)} MOEDAS`,
        x + width / 2,
        top + 6 + width * CARD_RATIO + 26,
        mono(13, 600),
        INK.gold,
        'center',
        1,
      );
    }),
  );
  return png(target);
}

export async function cardDetailImage(
  card: CardFace & { price: number },
  team: string,
): Promise<Buffer> {
  const { canvas: target, context } = canvas();
  const tier = rarity(card.overall);
  frame(context, 'Mercado', team, tier.color, peopleIcon);
  glow(context, 300, 380, 360, tier.color, 0.4);
  await playerCard(context, card, 300 - 140, 380 - 196, 280);
  write(
    context,
    `CARTA ${tier.label.toUpperCase()}`,
    620,
    170,
    mono(14, 600),
    tier.color,
    'left',
    4,
  );
  fit(context, card.name.toUpperCase(), 616, 250, 540, 96, INK.white, 'left');
  write(
    context,
    crop(context, `${card.position} · ${team}`, 540, display(30, 600)),
    620,
    316,
    display(30, 600),
    INK.body,
    'left',
    1,
  );
  stat(
    context,
    620,
    380,
    546,
    140,
    'Preço',
    `${fmt(card.price)} moedas`,
    undefined,
    INK.gold,
    coinsIcon,
  );
  return png(target);
}

// ── Missões ─────────────────────────────────────────────────────────────────────────────

const CADENCE = { daily: 'DIÁRIA', weekly: 'SEMANAL', monthly: 'MENSAL' } as const;

export function missionsImage(missions: MissionsResponse): Buffer {
  const { canvas: target, context } = canvas();
  const done = missions.missions.filter((mission) => mission.completed || mission.claimed).length;
  frame(
    context,
    'Missões',
    `${done}/${missions.missions.length} concluídas`,
    INK.info,
    clipboardIcon,
  );
  const top = heading(context, 'Missões', 'Lucro, packs, contratações e vendas contam progresso.');
  const shown = missions.missions.slice(0, 5);
  if (shown.length === 0) {
    raised(context, 34, top + 10, 1_132, 450);
    tactics(context, W / 2, top + 160);
    write(context, 'Nenhuma missão ativa', W / 2, top + 290, ui(26, 600), INK.white, 'center');
    write(
      context,
      'Conclua missões para ganhar recompensas e evoluir no FutHub.',
      W / 2,
      top + 330,
      ui(16),
      INK.mute,
      'center',
    );
  }
  shown.forEach((mission, index) => {
    const y = top + 8 + index * 92;
    const complete = mission.completed || mission.claimed;
    raised(context, 34, y, 1_132, 80, complete ? INK.success : undefined);
    if (complete) {
      glow(context, 82, y + 40, 30, INK.success, 0.35);
      check(context, 82, y + 40, 34, INK.success);
    } else {
      badge(context, 82, y + 40, INK.info, 18);
      clipboardIcon(context, 82, y + 40, INK.info);
    }
    write(context, CADENCE[mission.cadence], 118, y + 24, mono(10, 600), INK.info, 'left', 2);
    write(
      context,
      crop(context, mission.title, 520, ui(20, 600)),
      118,
      y + 52,
      ui(20, 600),
      complete ? INK.mute : INK.white,
    );
    const ratio = mission.goal > 0 ? Math.min(1, mission.progress / mission.goal) : 1;
    bar(context, 680, y + 46, 260, 10, ratio, complete ? INK.success : INK.info);
    write(
      context,
      `${fmt(mission.progress)}/${fmt(mission.goal)}`,
      940,
      y + 26,
      mono(12, 600),
      INK.mute,
      'right',
    );
    const reward = mission.reward
      ? `+${fmt(mission.reward.quantity)} ${REWARD[mission.reward.type] ?? mission.reward.type}`
      : '—';
    write(
      context,
      crop(context, reward.toUpperCase(), 180, display(26, 700)),
      1_136,
      y + 42,
      display(26, 700),
      complete ? INK.success : INK.gold,
      'right',
    );
  });
  if (missions.missions.length > shown.length)
    write(
      context,
      `+${missions.missions.length - shown.length} missões`,
      1_160,
      656,
      mono(11),
      INK.mute,
      'right',
      2,
    );
  return png(target);
}

export function missionCompleteImage(missions: readonly CompletedMissionDto[]): Buffer {
  const { canvas: target, context } = canvas();
  frame(context, 'Missões', 'concluída', INK.gold, clipboardIcon);
  rays(context, 300, 380, INK.gold, 16, 420);
  glow(context, 300, 380, 360, INK.gold, 0.45);
  context.save();
  context.translate(300, 370);
  context.scale(11, 11);
  trophy(
    context,
    0,
    0,
    gradient(context, -10, -10, 10, 12, [
      [0, '#ffe08a'],
      [0.5, '#e0a321'],
      [1, '#8a5a0c'],
    ]),
  );
  context.restore();
  starIcon(context, 300, 336, '#7a4c06');
  write(context, 'MISSÃO CONCLUÍDA', 620, 170, mono(14, 600), INK.gold, 'left', 4);
  write(
    context,
    missions.length > 1 ? `${missions.length} MISSÕES!` : 'MANDOU BEM!',
    616,
    250,
    display(96, 700),
    INK.white,
    'left',
    -1,
  );
  missions.slice(0, 3).forEach((mission, index) => {
    const y = 330 + index * 96;
    raised(context, 620, y, 546, 80, INK.gold);
    check(context, 656, y + 40, 28, INK.gold);
    write(
      context,
      crop(context, mission.title, 280, ui(18, 600)),
      684,
      y + 40,
      ui(18, 600),
      INK.white,
    );
    const label = `+${fmt(mission.reward.quantity)} ${REWARD[mission.reward.type] ?? mission.reward.type}`;
    write(context, label.toUpperCase(), 1_142, y + 42, display(30, 700), INK.gold, 'right');
  });
  return png(target);
}

// ── Resgate ─────────────────────────────────────────────────────────────────────────────

function gift(context: Ctx, cx: number, cy: number, opened: boolean): void {
  const ribbon = gradient(context, cx - 20, 0, cx + 20, 0, [
    [0, '#c9861a'],
    [0.5, '#ffd36b'],
    [1, '#c9861a'],
  ]);
  box(context, cx - 130, cy - 40, 260, 200, 16);
  context.fillStyle = gradient(context, cx - 130, cy - 40, cx + 130, cy + 160, [
    [0, '#9b6cf8'],
    [1, '#4c1d95'],
  ]);
  context.fill();
  context.fillStyle = 'rgba(0,0,0,0.18)';
  context.fillRect(cx + 40, cy - 40, 90, 200);
  context.fillStyle = ribbon;
  context.fillRect(cx - 20, cy - 40, 40, 200);
  context.save();
  if (opened) {
    context.translate(cx, cy - 120);
    context.rotate(-0.35);
    context.translate(-cx, -(cy - 120));
  }
  const lid = opened ? cy - 160 : cy - 92;
  box(context, cx - 150, lid, 300, 60, 12);
  context.fillStyle = gradient(context, cx - 150, lid, cx + 150, lid + 60, [
    [0, '#b794f6'],
    [1, '#6d3fd6'],
  ]);
  context.fill();
  context.fillStyle = ribbon;
  context.fillRect(cx - 20, lid, 40, 60);
  context.beginPath();
  context.ellipse(cx - 38, lid - 18, 38, 20, -0.4, 0, Math.PI * 2);
  context.ellipse(cx + 38, lid - 18, 38, 20, 0.4, 0, Math.PI * 2);
  context.strokeStyle = '#e8a93a';
  context.lineWidth = 12;
  context.stroke();
  context.restore();
}

export function redeemImage(code: string, reward: string | null, balance?: number): Buffer {
  const { canvas: target, context } = canvas();
  const opened = reward !== null;
  frame(context, 'Resgate', code, INK.gold, giftIcon);
  if (opened) rays(context, 320, 360, INK.gold, 14, 420);
  glow(context, 320, 360, 340, opened ? INK.gold : '#8b5cf6', 0.4);
  gift(context, 320, 380, opened);
  write(context, `CÓDIGO ${code}`, 640, 170, mono(14, 600), INK.gold, 'left', 4);
  fit(context, opened ? 'PRESENTE ABERTO' : 'ABRINDO…', 636, 250, 524, 90, INK.white);
  if (opened) {
    fit(context, reward.replaceAll('*', '').toUpperCase(), 640, 340, 520, 64, INK.gold);
    if (balance !== undefined)
      stat(context, 640, 400, 526, 140, 'Saldo', fmt(balance), undefined, INK.white, coinsIcon);
  }
  return png(target);
}

// ── Liga ────────────────────────────────────────────────────────────────────────────────

function divisionColor(color: string | null | undefined): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : INK.success;
}

export async function leagueImage(
  league: LeaguePanelState,
  ownerId: string,
  searchTick?: number,
): Promise<Buffer> {
  const { canvas: target, context } = canvas();
  const { status, match } = league;
  const color = divisionColor(status.division.color);
  frame(context, 'Liga', status.division.name, color, trophy);
  glow(context, 230, 300, 300, color, 0.35);
  const emblem = status.division.imageUrl ? await remoteImage(status.division.imageUrl) : undefined;
  if (emblem) {
    const size = 200;
    const scale = Math.min(size / emblem.width, size / emblem.height);
    context.drawImage(
      emblem,
      230 - (emblem.width * scale) / 2,
      210 - (emblem.height * scale) / 2,
      emblem.width * scale,
      emblem.height * scale,
    );
  } else shield(context, 230, 210, 150, 190, color);
  fit(context, status.division.name.toUpperCase(), 230, 350, 380, 56, INK.white, 'center');
  write(context, `${fmt(status.points)} PONTOS`, 230, 400, display(34, 700), color, 'center', 2);
  const record: [string, number, string][] = [
    ['VITÓRIAS', status.wins, INK.success],
    ['EMPATES', status.draws, INK.warning],
    ['DERROTAS', status.losses, INK.danger],
  ];
  record.forEach(([label, value, tint], index) =>
    stat(context, 34 + index * 134, 460, 122, 150, label, String(value), undefined, tint),
  );

  raised(context, 460, 96, 706, 514, color);
  if (status.queue?.kind === 'waiting') {
    const tick = searchTick ?? 0;
    spinner(context, 810, 170, 22, INK.info);
    write(context, 'FILA RANQUEADA', 810, 222, mono(14, 600), INK.info, 'center', 4);
    write(
      context,
      `PROCURANDO${'.'.repeat((tick % 3) + 1)}`,
      810,
      300,
      display(80, 700),
      INK.white,
      'center',
    );
    for (let index = 0; index < 5; index += 1) {
      context.beginPath();
      context.arc(730 + index * 40, 400, 10, 0, Math.PI * 2);
      context.fillStyle = index <= tick % 5 ? INK.info : INK.hairline;
      context.fill();
    }
    write(context, 'Buscando um adversário da sua divisão', 810, 470, ui(18), INK.body, 'center');
  } else if (match && status.queue?.kind === 'matched') {
    const home = match.home.id === ownerId;
    const own = home ? match.homeGoals : match.awayGoals;
    const other = home ? match.awayGoals : match.homeGoals;
    const [label, tint] =
      own > other
        ? ['VITÓRIA', INK.success]
        : own === other
          ? ['EMPATE', INK.warning]
          : ['DERROTA', INK.danger];
    glow(context, 810, 330, 300, tint, 0.3);
    write(context, 'ÚLTIMA PARTIDA', 810, 160, mono(13, 600), INK.mute, 'center', 4);
    write(context, label, 810, 232, display(90, 700), tint, 'center', 2);
    write(
      context,
      `${match.homeGoals}  ×  ${match.awayGoals}`,
      810,
      350,
      display(120, 700),
      INK.white,
      'center',
    );
    fit(context, match.home.name.toUpperCase(), 640, 460, 300, 30, INK.body, 'center', 600);
    fit(context, match.away.name.toUpperCase(), 980, 460, 300, 30, INK.body, 'center', 600);
    write(
      context,
      `${match.events.filter((event) => event.type === 'goal').length} GOLS · ${match.events.length} LANCES`,
      810,
      540,
      mono(12),
      INK.mute,
      'center',
      2,
    );
  } else {
    write(context, 'PRONTO PARA JOGAR', 810, 300, display(72, 700), INK.white, 'center');
    write(context, 'Busque uma partida valendo pontos', 810, 370, ui(20), INK.body, 'center');
  }
  return png(target);
}

// ── Partida de teste ────────────────────────────────────────────────────────────────────

export function matchLobbyImage(
  mode?: 'league' | 'friendly' | 'bots',
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  busy = false,
): Buffer {
  const { canvas: target, context } = canvas();
  frame(
    context,
    'Partida',
    busy ? 'preparando o jogo' : 'escolha seu desafio',
    INK.success,
    ballIcon,
  );
  heading(
    context,
    'Seu time em campo',
    'Dispute a liga, desafie um jogador ou treine contra bots.',
  );
  const modes = [
    ['league', 'LIGA', 'Vale pontos e divisão', INK.gold, trophy],
    ['friendly', 'AMISTOSO', 'Contra outro jogador', INK.info, peopleIcon],
    ['bots', 'CONTRA BOTS', 'Fácil · Médio · Difícil', INK.success, tactics],
  ] as const;
  modes.forEach(([value, title, subtitle, color, icon], index) => {
    const x = 34 + index * 382;
    raised(context, x, 236, 368, 278, mode === value ? color : INK.hairline);
    icon(context, x + 184, 300, color);
    write(context, title, x + 184, 368, display(38, 700), INK.white, 'center');
    write(context, subtitle, x + 184, 414, ui(18), INK.body, 'center');
    if (mode === value) write(context, 'SELECIONADO', x + 184, 474, mono(12), color, 'center', 1);
  });
  const description =
    mode === 'bots'
      ? `BOT ${difficulty === 'easy' ? 'FÁCIL · Força reduzida' : difficulty === 'hard' ? 'DIFÍCIL · Força elevada' : 'MÉDIO · Força equilibrada'}`
      : '11 titulares escalados para começar';
  write(
    context,
    busy ? 'PREPARANDO A PARTIDA...' : description,
    W / 2,
    566,
    ui(24, 600),
    INK.white,
    'center',
  );
  write(
    context,
    'Amistosos e bots não afetam sua campanha na liga.',
    W / 2,
    614,
    ui(18),
    INK.body,
    'center',
  );
  return png(target);
}

export function testMatchImage(match: TestMatch, step: MatchFrame): Buffer {
  const { canvas: target, context } = canvas();
  const events = match.events.slice(0, Math.max(1, step.revealed));
  const current = events.at(-1);
  const previous = events.at(-2);
  const next = match.events[step.revealed];
  const chance = step.beat === 'chance';
  const halftime = step.beat === 'halftime';
  const finished = !step.beat && current?.type === 'fulltime';
  const goal = !step.beat && current?.type === 'goal';
  const homeGoals = current?.homeGoals ?? 0;
  const awayGoals = current?.awayGoals ?? 0;
  const minute = halftime ? 45 : ((chance ? next : current)?.minute ?? 0);
  // Lado em destaque: quem acabou de marcar ou quem está chegando com perigo.
  const side = goal
    ? homeGoals > (previous?.homeGoals ?? 0)
      ? 'home'
      : 'away'
    : chance && next
      ? next.homeGoals > homeGoals
        ? 'home'
        : 'away'
      : undefined;
  const won = finished && homeGoals > awayGoals;
  const tint = goal
    ? INK.gold
    : chance
      ? INK.warning
      : halftime
        ? INK.info
        : current?.type === 'red_card'
          ? INK.danger
          : finished
            ? won
              ? INK.success
              : homeGoals === awayGoals
                ? INK.warning
                : INK.danger
            : INK.danger;
  frame(
    context,
    match.away.cpu ? 'Contra bots' : 'Amistoso',
    finished ? 'fim de jogo' : halftime ? 'intervalo' : `ao vivo · ${minute}'`,
    tint,
    ballIcon,
  );
  if (goal || won) rays(context, W / 2, 300, tint, 16, 800);
  glow(context, W / 2, 300, 420, tint, goal ? 0.5 : 0.22);
  const sideX = side === 'home' ? 290 : 910;
  if (side) glow(context, sideX, 260, 260, tint, chance ? 0.35 : 0.5);

  const nameColor = (team: 'home' | 'away') => (side === team ? tint : INK.white);
  fit(context, match.home.name.toUpperCase(), 290, 220, 380, 46, nameColor('home'), 'center', 600);
  fit(context, match.away.name.toUpperCase(), 910, 220, 380, 46, nameColor('away'), 'center', 600);
  write(context, `FORÇA ${match.home.rating}`, 290, 262, mono(12), INK.mute, 'center', 2);
  write(
    context,
    `${match.away.cpu ? `BOT ${match.difficulty === 'easy' ? 'FÁCIL' : match.difficulty === 'hard' ? 'DIFÍCIL' : 'MÉDIO'} · ` : ''}FORÇA ${match.away.rating}`,
    910,
    262,
    mono(12),
    INK.mute,
    'center',
    2,
  );
  const scoreColor = (team: 'home' | 'away') => (goal && side === team ? INK.gold : INK.white);
  write(context, `${homeGoals}`, 520, 330, display(170, 700), scoreColor('home'), 'center');
  write(context, '×', W / 2, 320, display(80, 600), INK.mute, 'center');
  write(context, `${awayGoals}`, 680, 330, display(170, 700), scoreColor('away'), 'center');

  box(context, W / 2 - 70, 112, 140, 44, 22);
  context.fillStyle = finished || halftime ? INK.raised2 : chance ? INK.warning : INK.danger;
  context.fill();
  write(
    context,
    finished ? 'FIM' : halftime ? 'INT' : `${minute}'`,
    W / 2,
    135,
    display(30, 700),
    INK.white,
    'center',
  );

  matchTimeline(context, events, minute, tint);

  const attacker = (side === 'home' ? match.home : match.away).name.toUpperCase();
  const banner = goal
    ? `GOOOL DO ${attacker}!`
    : chance
      ? `ATAQUE PERIGOSO DO ${attacker}...`
      : halftime
        ? 'INTERVALO'
        : current?.type === 'red_card'
          ? 'CARTÃO VERMELHO!'
          : current?.type === 'yellow_card'
            ? 'CARTÃO AMARELO'
            : finished
              ? won
                ? 'VITÓRIA!'
                : homeGoals === awayGoals
                  ? 'EMPATE'
                  : 'DERROTA'
              : 'APITO INICIAL';
  const description = chance
    ? CHANCES[minute % CHANCES.length]
    : halftime
      ? `Fim do primeiro tempo · ${match.home.name} ${homeGoals} × ${awayGoals} ${match.away.name}`
      : (current?.description ?? '');
  raised(context, 40, 470, 1_120, 160, tint);
  fit(
    context,
    banner,
    W / 2,
    530,
    1_060,
    64,
    goal || finished || chance ? tint : INK.white,
    'center',
  );
  write(
    context,
    crop(context, description ?? '', 1_060, ui(20)),
    W / 2,
    588,
    ui(20),
    INK.body,
    'center',
  );
  return png(target);
}

const CHANCES = [
  'Avança em velocidade pela ponta...',
  'Cruzamento venenoso na área...',
  'Fica cara a cara com o goleiro...',
  'Arrisca de fora da área...',
] as const;

/** Linha do tempo 0'–90': progresso até o minuto e um marcador por lance (casa em cima, fora embaixo). */
function matchTimeline(
  context: Ctx,
  events: TestMatch['events'],
  minute: number,
  color: string,
): void {
  const x = 140;
  const w = 920;
  const y = 438;
  bar(context, x, y - 3, w, 6, minute / 90, color);
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.fillRect(x + w / 2 - 1, y - 10, 2, 20);
  write(context, "0'", x - 14, y, mono(12), INK.mute, 'right');
  write(context, "90'", x + w + 14, y, mono(12), INK.mute, 'left');
  for (const [index, event] of events.entries()) {
    const at = x + (Math.min(event.minute, 90) / 90) * w;
    if (event.type === 'goal') {
      const my = event.homeGoals > (events[index - 1]?.homeGoals ?? 0) ? y - 19 : y + 19;
      glow(context, at, my, 18, INK.gold, 0.55);
      context.beginPath();
      context.arc(at, my, 10, 0, Math.PI * 2);
      context.fillStyle = INK.white;
      context.fill();
      ballIcon(context, at, my, INK.canvas);
    } else if (event.type === 'yellow_card' || event.type === 'red_card') {
      box(context, at - 4, y - 7, 8, 14, 2);
      context.fillStyle = event.type === 'red_card' ? INK.danger : '#facc15';
      context.fill();
    }
  }
}

// ── Ajuda ───────────────────────────────────────────────────────────────────────────────

export function helpImage(): Buffer {
  const { canvas: target, context } = canvas();
  frame(context, 'Ajuda', 'como jogar', INK.success, ballIcon);
  const top = heading(context, 'Como jogar', 'Monte o elenco e suba de divisão.');
  const steps: [string, string, string, typeof coinsIcon][] = [
    ['/lucro', 'Receba moedas', INK.success, coinsIcon],
    ['/loja', 'Compre packs', INK.gold, cardsIcon],
    ['/abrir-pack', 'Revele cartas', '#8b5cf6', starIcon],
    ['/time', 'Escale 11', INK.info, peopleIcon],
    ['Liga', 'Jogue valendo', INK.danger, trophy],
  ];
  steps.forEach(([command, label, color, icon], index) => {
    const x = 34 + index * 230;
    raised(context, x, top + 20, 212, 400, color);
    badge(context, x + 106, top + 76, color, 28);
    icon(context, x + 106, top + 76, color);
    write(
      context,
      String(index + 1),
      x + 106,
      top + 196,
      display(130, 700),
      alpha(color, 0.9),
      'center',
    );
    write(
      context,
      command.toUpperCase(),
      x + 106,
      top + 300,
      mono(15, 600),
      INK.white,
      'center',
      1,
    );
    write(context, label.toUpperCase(), x + 106, top + 346, display(30, 600), INK.body, 'center');
  });
  return png(target);
}
