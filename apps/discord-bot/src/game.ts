import type {
  LeagueStatusResponse,
  MatchResponse,
  OpenPackResponse,
  PurchaseCardResponse,
  PurchasePackResponse,
  QueueMatchedResponse,
  QueueMatchedResponseNullable,
  QueueWaitingResponse,
  QueueWaitingResponseNullable,
  SellCardsResponse,
} from '@futhub/api-client';

type QueueResult =
  | QueueMatchedResponse
  | QueueWaitingResponse
  | QueueMatchedResponseNullable
  | QueueWaitingResponseNullable;

const DISCORD_MESSAGE_LIMIT = 2_000;

function truncate(message: string): string {
  return message.length <= DISCORD_MESSAGE_LIMIT
    ? message
    : `${message.slice(0, DISCORD_MESSAGE_LIMIT - 3)}...`;
}

function progression(result: OpenPackResponse): string {
  const { gainedXp, level, nextLevelXp, rewards, xp } = result.progression;
  const reward = rewards.length
    ? ` Recompensas: ${rewards.map(({ quantity, type }) => `+${quantity} ${type}`).join(', ')}.`
    : '';
  return `XP: +${gainedXp} (${xp}/${nextLevelXp}). Nível: ${level}.${reward}`;
}

function division({ emoji, minimumPoints, name }: LeagueStatusResponse['division']): string {
  return `${emoji} ${name} (${minimumPoints} pontos mínimos)`;
}

function queue(result: QueueResult): string {
  if (!result) return 'Fila: sem partida pendente.';
  return result.kind === 'matched'
    ? `Partida: \`${result.matchId}\`.`
    : `Fila: aguardando adversário em ${division(result.division)}.`;
}

function discordTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('API returned an invalid match date.');
  return `<t:${Math.floor(date.getTime() / 1_000)}:F>`;
}

export function formatPackPurchase(result: PurchasePackResponse): string {
  return `Pack comprado. Quantidade: ${result.quantity}. Saldo: ${result.balance}.`;
}

export function formatPackOpen(result: OpenPackResponse): string {
  const cards = result.cards.length
    ? result.cards.map(({ card, id }) => `• \`${id}\` — OVR ${card.overall}`).join('\n')
    : 'Nenhuma carta recebida.';
  return truncate(`Pack aberto.\n${cards}\n${progression(result)}`);
}

export function formatRankedQueue(result: QueueMatchedResponse | QueueWaitingResponse): string {
  return result.kind === 'matched'
    ? `Adversário encontrado. Partida: \`${result.matchId}\`.`
    : `Você entrou na fila de ${division(result.division)}. Aguarde um adversário.`;
}

export function formatLeagueStatus(result: LeagueStatusResponse): string {
  return `${division(result.division)}\nPontos: ${result.points}. Vitórias: ${result.wins}. Empates: ${result.draws}. Derrotas: ${result.losses}.\n${queue(result.queue)}`;
}

export function formatQueueStatus(
  result: QueueMatchedResponseNullable | QueueWaitingResponseNullable,
): string {
  return queue(result);
}

export function formatMatch(result: MatchResponse): string {
  const events = result.events.length
    ? result.events.map(({ description, minute }) => `${minute}' — ${description}`).join('\n')
    : 'Sem eventos registrados.';
  return truncate(
    `Partida \`${result.id}\`: ${result.homeGoals} × ${result.awayGoals}. Finalizada ${discordTimestamp(result.completedAt)}.\n${events}`,
  );
}

export function formatCardPurchase(result: PurchaseCardResponse): string {
  return `Carta comprada. ID no elenco: \`${result.userCardId}\`. Preço: ${result.price}. Saldo: ${result.balance}.`;
}

export function formatCardsSale(result: SellCardsResponse): string {
  return `${result.userCardIds.length} carta(s) vendida(s). Recebido: ${result.amount}. Saldo: ${result.balance}.`;
}
