import type {
  CompletedMissionDto,
  LucroResponse,
  MissionDtoCadence,
  MissionsResponse,
  OpenPackResponse,
  PurchaseCardResponse,
  PurchasePackResponse,
  RedeemCodeResponse,
} from '@futhub/api-client';
import type { ListItem, TemplateData } from '@futhub/bot-templates';

import { EMOJI, entityIcon } from './emojis.js';
import { bold, fmt, timestamp } from './format.js';
import { rarity } from './juice.js';

// Turns API results into the variables and lists declared in the bot-templates catalog.

const CADENCE_LABEL: Record<MissionDtoCadence, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

const REWARD_LABEL: Record<string, string> = {
  balance: 'moedas',
  card: 'carta',
  field: 'campo',
  pack: 'pack',
  premium: 'premium',
};

function apiTimestamp(value: string, style: 'F' | 'R'): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('API returned an invalid date.');
  return timestamp(date, style);
}

function rewards(items: readonly { type: string; quantity: number }[]): ListItem[] {
  return items.map(({ type, quantity }) => ({
    type,
    label: REWARD_LABEL[type] ?? type,
    quantity: String(quantity),
  }));
}

export function lucroData(
  result: LucroResponse,
  now: Date,
): { key: 'lucro.success' | 'lucro.cooldown'; data: TemplateData } {
  const availableAt = apiTimestamp(result.availableAt, 'F');
  const availableIn = apiTimestamp(result.availableAt, 'R');
  if (result.kind === 'cooldown') {
    const remaining = Math.max(
      0,
      Math.ceil((new Date(result.availableAt).getTime() - now.getTime()) / 1000),
    );
    return {
      key: 'lucro.cooldown',
      data: { availableAt, availableIn, remaining: String(remaining) },
    };
  }
  const { report, progression } = result;
  return {
    key: 'lucro.success',
    data: {
      message: result.reward.message,
      reward: String(result.reward.value),
      balance: String(result.balance),
      xp: String(progression.gainedXp),
      xpTotal: String(progression.xp),
      nextLevelXp: String(progression.nextLevelXp),
      level: String(progression.level),
      availableAt,
      availableIn,
      net: String(report.net),
      // Same signs the bot always printed: revenues "+", costs "-", net signed only when >= 0.
      report: [
        ['Bilheteria', `+${report.ticketRevenue}`, report.ticketRevenue],
        ['Receita comercial', `+${report.commercialRevenue}`, report.commercialRevenue],
        ['Patrocinador', `+${report.sponsorRevenue}`, report.sponsorRevenue],
        ['Manutenção', `-${report.maintenance}`, report.maintenance],
        ['Folha salarial', `-${report.payroll}`, report.payroll],
        ['Lucro líquido', `${report.net >= 0 ? '+' : ''}${report.net}`, Math.abs(report.net)],
      ].map(([label, value, amount]) => ({
        label: String(label),
        value: String(value),
        amount: String(amount),
      })),
      rewards: rewards(progression.rewards),
    },
  };
}

export function missionsData(result: MissionsResponse): TemplateData {
  return {
    missions: result.missions.map((mission) => {
      const ratio = mission.goal > 0 ? Math.min(1, mission.progress / mission.goal) : 1;
      const filled = Math.round(ratio * 10);
      return {
        title: mission.title,
        cadence: CADENCE_LABEL[mission.cadence],
        progress: String(mission.progress),
        goal: String(mission.goal),
        percent: String(Math.round(ratio * 100)),
        bar: '▰'.repeat(filled) + '▱'.repeat(10 - filled),
        status: mission.claimed
          ? 'concluída; recompensa concedida'
          : `${mission.progress}/${mission.goal}`,
        expires: apiTimestamp(mission.expiresAt, 'R'),
        reward: mission.reward
          ? `Recompensa: +${fmt(mission.reward.quantity)} ${REWARD_LABEL[mission.reward.type] ?? mission.reward.type}`
          : 'Sem recompensa',
        done: mission.claimed || mission.completed ? '✅' : '🎯',
      };
    }),
  };
}

export function completedMissionsData(missions: readonly CompletedMissionDto[]): TemplateData {
  return {
    completedMissions: missions.map(({ title, cadence, reward }) => {
      const label = REWARD_LABEL[reward.type] ?? reward.type;
      return {
        title,
        cadence: CADENCE_LABEL[cadence],
        reward: `+${reward.quantity} ${label}`,
        type: reward.type,
        label,
        quantity: String(reward.quantity),
      };
    }),
  };
}

/** Emoji do pack nos templates: o da imagem do pack, ou o emoji de pack do bot. */
function packEmoji(emoji: string): string {
  return entityIcon(emoji) || EMOJI.pack;
}

export function packOpenData(
  packId: string,
  pack: Readonly<{ name: string; emoji: string }>,
  result: OpenPackResponse,
): TemplateData {
  const { gainedXp, level, nextLevelXp, xp } = result.progression;
  return {
    packId,
    packName: pack.name,
    packEmoji: packEmoji(pack.emoji),
    xp: String(gainedXp),
    xpTotal: String(xp),
    nextLevelXp: String(nextLevelXp),
    level: String(level),
    // Best card first: the reveal ends on it and the list reads as a ranking.
    cards: [...result.cards]
      .sort((left, right) => right.card.overall - left.card.overall)
      .map(({ id, card }) => ({
        id,
        name: card.name,
        position: card.position,
        overall: String(card.overall),
        rarity: rarity(card.overall).label,
        tierEmoji: rarity(card.overall).emoji,
        team: card.team.name,
        teamEmoji: entityIcon(card.team.emoji),
        collection: card.collection.name,
        collectionEmoji: entityIcon(card.collection.emoji),
      })),
    rewards: rewards(result.progression.rewards),
  };
}

export function packPurchaseData(
  pack: Readonly<{ id: string; name: string; emoji: string; price: number }>,
  result: PurchasePackResponse,
): TemplateData {
  return {
    packId: pack.id,
    packName: pack.name,
    packEmoji: packEmoji(pack.emoji),
    price: String(pack.price),
    quantity: String(result.quantity),
    balance: String(result.balance),
  };
}

export function cardPurchaseData(
  card: Readonly<{ name: string; overall: number; position: string; imageUrl: string | null }>,
  result: PurchaseCardResponse,
): TemplateData {
  return {
    userCardId: result.userCardId,
    cardName: card.name,
    cardOverall: String(card.overall),
    cardPosition: card.position,
    cardRarity: rarity(card.overall).label,
    cardImageUrl: card.imageUrl ?? '',
    price: String(result.price),
    balance: String(result.balance),
  };
}

const REDEEM_REJECTION: Record<
  Extract<RedeemCodeResponse, { kind: 'rejected' }>['reason'],
  string
> = {
  not_found: 'Código inválido. Confira se digitou corretamente.',
  inactive: 'Este código não está mais ativo.',
  expired: 'Este código expirou.',
  already_redeemed: 'Você já resgatou este código.',
  exhausted: 'Este código atingiu o limite de resgates.',
  inventory_full: 'Seu elenco está cheio. Venda cartas antes de resgatar este código.',
};

function redeemRewardLabel(
  reward: Extract<RedeemCodeResponse, { kind: 'success' }>['reward'],
): string {
  if (reward.type === 'balance') return `+${reward.quantity} moedas`;
  const name = reward.resourceName ? ` ${bold(reward.resourceName)}` : '';
  const label = REWARD_LABEL[reward.type] ?? reward.type;
  return reward.quantity > 1 ? `${reward.quantity}× ${label}${name}` : `${label}${name}`;
}

export function redeemData(
  typedCode: string,
  result: RedeemCodeResponse,
): { key: 'resgatar.success' | 'resgatar.rejected'; data: TemplateData } {
  if (result.kind === 'rejected')
    return {
      key: 'resgatar.rejected',
      data: { code: typedCode.trim().toUpperCase(), reason: REDEEM_REJECTION[result.reason] },
    };
  return {
    key: 'resgatar.success',
    data: {
      code: result.code,
      rewardLabel: redeemRewardLabel(result.reward),
      balance: String(result.balance),
    },
  };
}
