import type * as DatabaseModule from '@futhub/database';

export type DiscordIdentity = Readonly<{ id: string; name: string; avatarUrl: string | null }>;

type Database = typeof DatabaseModule;
type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

export async function upsertDiscordUser(
  tx: Transaction,
  schema: Database['schema'],
  identity: DiscordIdentity,
  now: Date,
): Promise<{ id: string; balance: number; language: string }> {
  const [user] = await tx
    .insert(schema.users)
    .values({ discordUserId: identity.id, nome: identity.name, urlAvatar: identity.avatarUrl })
    .onConflictDoUpdate({
      target: schema.users.discordUserId,
      set: { nome: identity.name, urlAvatar: identity.avatarUrl, atualizadoEm: now },
    })
    .returning({
      id: schema.users.id,
      balance: schema.users.saldo,
      language: schema.users.language,
    });
  if (!user) throw new Error('Failed to load user.');
  return user;
}

export async function cardInventoryCapacity(
  database: Database,
  tx: Transaction,
  userId: string,
): Promise<{ cardCount: number; maxCards: number }> {
  const { eq, schema, sql } = database;
  await tx.insert(schema.gameSettings).values({ singleton: true }).onConflictDoNothing();
  const [[settings], [inventory]] = await Promise.all([
    tx.select({ maxCards: schema.gameSettings.maxCardsPerUser }).from(schema.gameSettings).limit(1),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.userCards)
      .where(eq(schema.userCards.userId, userId)),
  ]);
  if (!settings) throw new Error('Game settings unavailable.');
  if (!inventory) throw new Error('Failed to count user cards.');
  return { cardCount: inventory.count, maxCards: settings.maxCards };
}
