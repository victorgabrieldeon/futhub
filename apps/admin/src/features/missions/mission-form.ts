import type { AdminMission, AdminMissionInput } from '@futhub/api-client';

export type MissionType = AdminMissionInput['type'];
export type MissionCadence = AdminMissionInput['cadence'];
export type RewardType = AdminMissionInput['rewards'][number]['type'];

export type MissionRewardDraft = Readonly<{
  /** Stable React key; never sent to the API. */
  key: string;
  type: RewardType;
  amount: string;
  resourceId: string;
}>;

export type MissionDraft = Readonly<{
  title: string;
  type: MissionType;
  cadence: MissionCadence;
  tier: string;
  goal: string;
  active: boolean;
  rewards: readonly MissionRewardDraft[];
}>;

export const missionTypeLabels: Record<MissionType, string> = {
  claim_profit: 'Resgatar lucro',
  open_pack: 'Abrir packs',
  buy_pack: 'Comprar packs',
  buy_player: 'Contratar jogadores',
  sell_player: 'Vender jogadores',
  spend_balance: 'Gastar moedas',
  play_match: 'Jogar partidas',
  win_match: 'Vencer partidas',
};

export const cadenceLabels: Record<MissionCadence, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

export const rewardTypeLabels: Record<RewardType, string> = {
  balance: 'Moedas',
  card: 'Carta',
  pack: 'Pack',
  field: 'Campo',
};

const goalUnits: Record<MissionType, [string, string]> = {
  claim_profit: ['resgate', 'resgates'],
  open_pack: ['pack aberto', 'packs abertos'],
  buy_pack: ['pack comprado', 'packs comprados'],
  buy_player: ['contratação', 'contratações'],
  sell_player: ['jogador vendido', 'jogadores vendidos'],
  spend_balance: ['moeda', 'moedas'],
  play_match: ['partida', 'partidas'],
  win_match: ['vitória', 'vitórias'],
};

const titleTemplates: Record<MissionType, (goal: number) => string> = {
  claim_profit: (goal) => (goal === 1 ? 'Resgate o lucro' : `Resgate o lucro ${goal} vezes`),
  open_pack: (goal) => (goal === 1 ? 'Abra um pack' : `Abra ${goal} packs`),
  buy_pack: (goal) => (goal === 1 ? 'Compre um pack' : `Compre ${goal} packs`),
  buy_player: (goal) => (goal === 1 ? 'Contrate um jogador' : `Contrate ${goal} jogadores`),
  sell_player: (goal) => (goal === 1 ? 'Venda um jogador' : `Venda ${goal} jogadores`),
  spend_balance: (goal) => `Gaste ${goal.toLocaleString('pt-BR')} moedas`,
  play_match: (goal) => (goal === 1 ? 'Jogue uma partida' : `Jogue ${goal} partidas`),
  win_match: (goal) => (goal === 1 ? 'Vença uma partida' : `Vença ${goal} partidas`),
};

let rewardKeys = 0;

export function newRewardDraft(
  reward: Partial<Omit<MissionRewardDraft, 'key'>> = {},
): MissionRewardDraft {
  rewardKeys += 1;
  return {
    key: `reward-${rewardKeys}`,
    type: 'balance',
    amount: '100',
    resourceId: '',
    ...reward,
  };
}

export function emptyDraft(): MissionDraft {
  return {
    title: '',
    type: 'claim_profit',
    cadence: 'daily',
    tier: '1',
    goal: '1',
    active: true,
    rewards: [newRewardDraft()],
  };
}

export function goalUnit(type: MissionType, goal: number): string {
  const [singular, plural] = goalUnits[type];
  return goal === 1 ? singular : plural;
}

/** Title shown as placeholder and sent when the admin leaves the field empty. */
export function suggestedTitle(type: MissionType, goalValue: string): string {
  const goal = Number(goalValue);
  return titleTemplates[type](Number.isSafeInteger(goal) && goal > 0 ? goal : 1);
}

export function rewardLabel(reward: AdminMission['rewards'][number]): string {
  if (reward.type === 'balance') return `${reward.amount.toLocaleString('pt-BR')} moedas`;
  const name = reward.resourceName ?? 'recurso removido';
  const label = rewardTypeLabels[reward.type].toLowerCase();
  return reward.amount > 1 ? `${reward.amount}× ${label} ${name}` : `${label} ${name}`;
}

export function draftFrom(mission: AdminMission): MissionDraft {
  return {
    title: mission.title,
    type: mission.type,
    cadence: mission.cadence,
    tier: String(mission.tier),
    goal: String(mission.goal),
    active: mission.active,
    rewards: mission.rewards.map((reward) =>
      newRewardDraft({
        type: reward.type,
        amount: String(reward.amount),
        resourceId: reward.resourceId ?? '',
      }),
    ),
  };
}

/** Returns the API payload or the first problem an admin must fix. */
export function inputFrom(draft: MissionDraft): { input: AdminMissionInput } | { error: string } {
  const goal = Number(draft.goal);
  if (!Number.isSafeInteger(goal) || goal < 1)
    return { error: 'A meta deve ser um número inteiro maior que zero.' };
  const tier = Number(draft.tier);
  if (!Number.isSafeInteger(tier) || tier < 1 || tier > 10)
    return { error: 'O tier deve ser um inteiro de 1 a 10.' };
  if (draft.rewards.length === 0) return { error: 'Adicione ao menos uma recompensa.' };
  const rewards: AdminMissionInput['rewards'] = [];
  for (const reward of draft.rewards) {
    const amount = Number(reward.amount);
    if (!Number.isSafeInteger(amount) || amount < 1)
      return { error: 'A quantidade de cada recompensa deve ser um inteiro maior que zero.' };
    if (reward.type === 'field' && amount !== 1)
      return { error: 'Campos são concedidos uma única vez; use quantidade 1.' };
    if (reward.type !== 'balance' && !reward.resourceId)
      return { error: `Escolha ${rewardTypeLabels[reward.type].toLowerCase()} da recompensa.` };
    rewards.push({
      type: reward.type,
      amount,
      resourceId: reward.type === 'balance' ? null : reward.resourceId,
    });
  }
  const keys = rewards.map((reward) => `${reward.type}:${reward.amount}:${reward.resourceId}`);
  if (new Set(keys).size !== keys.length) return { error: 'Há recompensas repetidas no sorteio.' };
  return {
    input: {
      title: draft.title.trim() || suggestedTitle(draft.type, draft.goal),
      type: draft.type,
      cadence: draft.cadence,
      tier,
      goal,
      active: draft.active,
      rewards,
    },
  };
}

/** Each active tier with rewards is one slot: players get one mission per slot per cycle. */
export function slotsPerCadence(missions: readonly AdminMission[]): Record<MissionCadence, number> {
  const slots = { daily: new Set<number>(), weekly: new Set<number>(), monthly: new Set<number>() };
  for (const mission of missions)
    if (mission.active && mission.rewards.length) slots[mission.cadence].add(mission.tier);
  return { daily: slots.daily.size, weekly: slots.weekly.size, monthly: slots.monthly.size };
}
