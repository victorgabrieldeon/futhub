import type {
  OpenPackResponse,
  PackCatalogItem,
  PurchaseCardResponse,
  PurchasePackResponse,
  SellCardsResponse,
} from '@futhub/api-client';

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

export function formatPackPurchase(result: PurchasePackResponse): string {
  return `Pack comprado. Quantidade: ${result.quantity}. Saldo: ${result.balance}.`;
}

export function formatPackStore(packs: readonly PackCatalogItem[]): string {
  if (!packs.length) return '## Loja\n### Packs\nNenhum pack disponível agora.';
  const options = packs
    .map(
      ({ cardsAmount, emoji, id, limitPerUser, name, price }) =>
        `${emoji} **${name}** — ${cardsAmount} carta(s), ${price} moedas, limite ${limitPerUser}.\nID: \`${id}\``,
    )
    .join('\n\n');
  return truncate(`## Loja\n### Packs\n${options}\n\nComprar: \`/loja aba:packs pack_id:<ID>\`.`);
}

export function formatPackOpen(result: OpenPackResponse): string {
  const cards = result.cards.length
    ? result.cards.map(({ card, id }) => `• \`${id}\` — OVR ${card.overall}`).join('\n')
    : 'Nenhuma carta recebida.';
  return truncate(`Pack aberto.\n${cards}\n${progression(result)}`);
}

export function formatCardPurchase(result: PurchaseCardResponse): string {
  return `Carta comprada. ID no elenco: \`${result.userCardId}\`. Preço: ${result.price}. Saldo: ${result.balance}.`;
}

export function formatCardsSale(result: SellCardsResponse): string {
  return `${result.userCardIds.length} carta(s) vendida(s). Recebido: ${result.amount}. Saldo: ${result.balance}.`;
}
