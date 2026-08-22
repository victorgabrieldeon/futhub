import type * as DatabaseModule from '@futhub/database';
import { cardInventoryCapacity } from '../users/user.repository.js';

export type XpCommand = 'lucro' | 'open_pack';
export type ProgressionReward = Readonly<{
  itemId: string;
  type: 'card' | 'pack' | 'balance' | 'field';
  quantity: number;
  resourceId: string | null;
}>;
export type ProgressionSummary = Readonly<{
  gainedXp: number;
  level: number;
  xp: number;
  nextLevelXp: number;
  rewards: readonly ProgressionReward[];
}>;

type Database = typeof DatabaseModule;
type DatabaseTransaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type ProgressionState = Readonly<{
  xp: number;
  level: number;
  crossedLevels: number[];
}>;
type RewardItem = Readonly<{
  itemId: string;
  type: string;
  amount: number;
  cardId: string | null;
  packId: string | null;
  soccerFieldId: string | null;
}>;

const defaultXp = 10;

export function getXpForLevel(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1)
    throw new Error('Level must be a positive integer.');
  const required = Math.floor((100 * level ** 1.5) / 50) * 50;
  if (!Number.isSafeInteger(required) || required < 1)
    throw new Error('Level XP requirement is invalid.');
  return required;
}

export function progressXp(
  currentXp: number,
  currentLevel: number,
  gainedXp: number,
): ProgressionState {
  if (!Number.isSafeInteger(currentXp) || currentXp < 0) throw new Error('Current XP is invalid.');
  if (!Number.isSafeInteger(gainedXp) || gainedXp < 0) throw new Error('Gained XP is invalid.');
  if (!Number.isSafeInteger(currentLevel) || currentLevel < 1)
    throw new Error('Current level is invalid.');

  let xp = currentXp + gainedXp;
  let level = currentLevel;
  const crossedLevels: number[] = [];
  while (xp >= getXpForLevel(level)) {
    xp -= getXpForLevel(level);
    crossedLevels.push(level);
    level += 1;
  }
  if (!Number.isSafeInteger(xp) || !Number.isSafeInteger(level))
    throw new Error('XP progression exceeds supported range.');
  return { xp, level, crossedLevels };
}

async function getCommandXp(
  database: Database,
  tx: DatabaseTransaction,
  command: XpCommand,
): Promise<number> {
  const { eq, schema, sql } = database;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`command-xp:${command}`}))`);
  const [created] = await tx
    .insert(schema.commandXpConfigs)
    .values({ command, xp: defaultXp })
    .onConflictDoNothing()
    .returning({ xp: schema.commandXpConfigs.xp });
  if (created) return created.xp;

  const config = await tx.query.commandXpConfigs.findFirst({
    columns: { xp: true },
    where: eq(schema.commandXpConfigs.command, command),
  });
  if (!config) throw new Error(`XP configuration unavailable for ${command}.`);
  return config.xp;
}

export async function grantReward(
  database: Database,
  tx: DatabaseTransaction,
  userId: string,
  item: RewardItem,
  now: Date,
  claimedBy: 'mission' | 'reward' = 'reward',
): Promise<ProgressionReward> {
  const { eq, schema, sql } = database;
  if (!Number.isSafeInteger(item.amount) || item.amount < 1)
    throw new Error('Reward amount is invalid.');

  switch (item.type) {
    case 'balance': {
      const [updated] = await tx
        .update(schema.users)
        .set({ saldo: sql`${schema.users.saldo} + ${item.amount}`, atualizadoEm: now })
        .where(eq(schema.users.id, userId))
        .returning({ id: schema.users.id });
      if (!updated) throw new Error('Failed to credit level reward balance.');
      await tx
        .insert(schema.transactionHistory)
        .values({ userId, type: 'reward', amount: item.amount });
      return { itemId: item.itemId, type: item.type, quantity: item.amount, resourceId: null };
    }
    case 'card': {
      const cardId = item.cardId;
      if (!cardId) throw new Error('Card reward has no card.');
      const inventory = await cardInventoryCapacity(database, tx, userId);
      if (inventory.cardCount + item.amount > inventory.maxCards)
        throw new Error('Card inventory capacity exceeded.');
      const cards: Array<typeof schema.userCards.$inferInsert> = Array.from(
        { length: item.amount },
        () => ({ userId, cardId, claimedBy, claimedAt: now }),
      );
      await tx.insert(schema.userCards).values(cards);
      return {
        itemId: item.itemId,
        type: item.type,
        quantity: item.amount,
        resourceId: cardId,
      };
    }
    case 'pack': {
      if (!item.packId) throw new Error('Pack reward has no pack.');
      await tx
        .insert(schema.userPacks)
        .values({ userId, packId: item.packId, quantity: item.amount })
        .onConflictDoUpdate({
          target: [schema.userPacks.userId, schema.userPacks.packId],
          set: { quantity: sql`${schema.userPacks.quantity} + ${item.amount}` },
        });
      return {
        itemId: item.itemId,
        type: item.type,
        quantity: item.amount,
        resourceId: item.packId,
      };
    }
    case 'field': {
      if (!item.soccerFieldId) throw new Error('Field reward has no field.');
      await tx
        .insert(schema.userSoccerFields)
        .values({ userId, soccerFieldId: item.soccerFieldId })
        .onConflictDoNothing();
      return {
        itemId: item.itemId,
        type: item.type,
        quantity: item.amount,
        resourceId: item.soccerFieldId,
      };
    }
    default:
      throw new Error(`Unsupported level reward item type: ${item.type}.`);
  }
}

export async function grantCommandXp(
  database: Database,
  tx: DatabaseTransaction,
  userId: string,
  command: XpCommand,
  now: Date,
): Promise<ProgressionSummary> {
  const { asc, eq, inArray, schema, sql } = database;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`xp:${userId}`}))`);
  const gainedXp = await getCommandXp(database, tx, command);
  const [user] = await tx
    .select({ xp: schema.users.xp, level: schema.users.level })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  if (!user) throw new Error('User not found for XP progression.');

  const progression = progressXp(user.xp, user.level, gainedXp);
  const [updated] = await tx
    .update(schema.users)
    .set({ xp: progression.xp, level: progression.level, atualizadoEm: now })
    .where(eq(schema.users.id, userId))
    .returning({ id: schema.users.id });
  if (!updated) throw new Error('Failed to update XP progression.');

  const rewards = progression.crossedLevels.length
    ? await tx
        .select({
          itemId: schema.items.id,
          type: schema.items.type,
          amount: schema.items.amount,
          cardId: schema.items.cardId,
          packId: schema.items.packId,
          soccerFieldId: schema.items.soccerFieldId,
        })
        .from(schema.levelRewards)
        .innerJoin(schema.items, eq(schema.levelRewards.itemId, schema.items.id))
        .where(inArray(schema.levelRewards.level, progression.crossedLevels))
        .orderBy(asc(schema.levelRewards.level))
    : [];
  const grantedRewards: ProgressionReward[] = [];
  for (const reward of rewards) {
    grantedRewards.push(await grantReward(database, tx, userId, reward, now));
  }

  return {
    gainedXp,
    level: progression.level,
    xp: progression.xp,
    nextLevelXp: getXpForLevel(progression.level),
    rewards: grantedRewards,
  };
}
