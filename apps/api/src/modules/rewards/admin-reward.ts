import type * as DatabaseModule from '@futhub/database';
import { BadRequestException } from '@nestjs/common';

type Database = typeof DatabaseModule;
type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

/** Reward an admin attaches to a redeem code or mission; stored as an `items` row. */
export type AdminRewardInput = Readonly<{
  type: 'card' | 'pack' | 'balance' | 'field';
  amount: number;
  resourceId: string | null;
}>;

export type AdminRewardOptions = Readonly<{
  cards: { id: string; name: string }[];
  packs: { id: string; name: string }[];
  fields: { id: string; name: string }[];
}>;

const adminLocale = 'pt-BR';

export function adminRewardItemValues(reward: AdminRewardInput) {
  return {
    type: reward.type,
    amount: reward.amount,
    cardId: reward.type === 'card' ? reward.resourceId : null,
    packId: reward.type === 'pack' ? reward.resourceId : null,
    soccerFieldId: reward.type === 'field' ? reward.resourceId : null,
    premiumId: null,
  };
}

export async function assertAdminRewardResource(
  database: Database,
  tx: Transaction,
  reward: AdminRewardInput,
): Promise<void> {
  const { eq, schema } = database;
  if (reward.type === 'balance') {
    if (reward.resourceId !== null)
      throw new BadRequestException('Recompensa em moedas não referencia recurso.');
    return;
  }
  if (reward.type === 'field' && reward.amount !== 1)
    throw new BadRequestException('Campos são concedidos uma única vez; use quantidade 1.');
  const resourceId = reward.resourceId;
  if (!resourceId) throw new BadRequestException('Escolha o recurso concedido pela recompensa.');
  const table = {
    card: schema.cards,
    pack: schema.packs,
    field: schema.soccerFields,
  }[reward.type];
  const [resource] = await tx.select({ id: table.id }).from(table).where(eq(table.id, resourceId));
  if (!resource) throw new BadRequestException('Recurso da recompensa não encontrado.');
}

export async function adminRewardOptions(database: Database): Promise<AdminRewardOptions> {
  const { asc, eq, schema } = database;
  const [cards, packs, fields] = await Promise.all([
    database.db
      .select({ id: schema.cards.id, name: schema.cards.name })
      .from(schema.cards)
      .orderBy(asc(schema.cards.name)),
    database.db
      .select({ id: schema.packs.id, name: schema.packs.name })
      .from(schema.packs)
      .orderBy(asc(schema.packs.name)),
    database.db
      .select({ id: schema.soccerFields.id, name: schema.localizedTextTranslations.content })
      .from(schema.soccerFields)
      .innerJoin(
        schema.localizedTextTranslations,
        eq(schema.localizedTextTranslations.localizedTextId, schema.soccerFields.nameTextId),
      )
      .where(eq(schema.localizedTextTranslations.locale, adminLocale))
      .orderBy(asc(schema.localizedTextTranslations.content)),
  ]);
  return { cards, packs, fields };
}
