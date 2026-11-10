import type * as DatabaseModule from '@futhub/database';

import type { RedeemRewardType } from '../use-cases/resgatar-codigo/resgatar-codigo.types.js';

type Database = typeof DatabaseModule;
export type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

export type RewardItemRow = Readonly<{
  itemId: string;
  type: string;
  amount: number;
  cardId: string | null;
  packId: string | null;
  soccerFieldId: string | null;
}>;

export const redeemRewardTypes = ['card', 'pack', 'balance', 'field'] as const;

export function isRedeemRewardType(type: string): type is RedeemRewardType {
  return (redeemRewardTypes as readonly string[]).includes(type);
}

export function rewardItemColumns(database: Database) {
  const { schema } = database;
  return {
    itemId: schema.items.id,
    type: schema.items.type,
    amount: schema.items.amount,
    cardId: schema.items.cardId,
    packId: schema.items.packId,
    soccerFieldId: schema.items.soccerFieldId,
  };
}

export function rewardResourceId(item: RewardItemRow): string | null {
  return item.cardId ?? item.packId ?? item.soccerFieldId;
}

/** Resolves display names of the Cards, Packs and fields referenced by reward Items. */
export async function rewardResourceNames(
  database: Database,
  tx: Transaction,
  items: readonly RewardItemRow[],
  locale: string,
): Promise<Map<string, string>> {
  const { and, eq, inArray, schema } = database;
  const cardIds = items.flatMap((item) => (item.cardId ? [item.cardId] : []));
  const packIds = items.flatMap((item) => (item.packId ? [item.packId] : []));
  const fieldIds = items.flatMap((item) => (item.soccerFieldId ? [item.soccerFieldId] : []));
  const [cards, packs, fields] = await Promise.all([
    cardIds.length
      ? tx
          .select({ id: schema.cards.id, name: schema.cards.name })
          .from(schema.cards)
          .where(inArray(schema.cards.id, cardIds))
      : [],
    packIds.length
      ? tx
          .select({ id: schema.packs.id, name: schema.packs.name })
          .from(schema.packs)
          .where(inArray(schema.packs.id, packIds))
      : [],
    fieldIds.length
      ? tx
          .select({
            id: schema.soccerFields.id,
            locale: schema.localizedTextTranslations.locale,
            name: schema.localizedTextTranslations.content,
          })
          .from(schema.soccerFields)
          .innerJoin(
            schema.localizedTextTranslations,
            eq(schema.localizedTextTranslations.localizedTextId, schema.soccerFields.nameTextId),
          )
          .where(
            and(
              inArray(schema.soccerFields.id, fieldIds),
              inArray(schema.localizedTextTranslations.locale, [locale, 'pt-BR']),
            ),
          )
      : [],
  ]);
  const names = new Map<string, string>();
  for (const row of [...cards, ...packs]) names.set(row.id, row.name);
  for (const row of fields)
    if (row.locale === locale || !names.has(row.id)) names.set(row.id, row.name);
  return names;
}
