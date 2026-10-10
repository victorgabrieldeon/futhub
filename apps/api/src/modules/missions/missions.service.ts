import type * as DatabaseModule from '@futhub/database';

import { type ProgressionReward, grantReward } from '../progression/progression.js';
import { upsertDiscordUser } from '../users/user.repository.js';
import { type MissionCadence, missionCycle } from './mission-period.js';

export type DiscordIdentity = Readonly<{ id: string; name: string; avatarUrl: string | null }>;
export type MissionEventType =
  | 'open_pack'
  | 'sell_player'
  | 'claim_profit'
  | 'play_match'
  | 'buy_pack'
  | 'buy_player'
  | 'win_match'
  | 'spend_balance';
export type MissionReward = Readonly<{
  itemId: string;
  type: 'card' | 'pack' | 'balance' | 'field' | 'premium';
  quantity: number;
  resourceId: string | null;
}>;
export type MissionSummary = Readonly<{
  id: string;
  title: string;
  type: MissionEventType;
  cadence: MissionCadence;
  tier: number;
  goal: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  expiresAt: Date;
  reward: MissionReward | null;
}>;
/** Mission completed (and rewarded) by the event that just happened. */
export type CompletedMission = Readonly<{
  id: string;
  title: string;
  cadence: MissionCadence;
  reward: ProgressionReward;
}>;

type Database = typeof DatabaseModule;
type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type DatabaseLoader = () => Promise<Database>;
type MissionDefinition = Readonly<{
  id: string;
  cadence: MissionCadence;
  tier: number;
}>;

function itemResourceId(item: {
  cardId: string | null;
  packId: string | null;
  soccerFieldId: string | null;
  premiumId: string | null;
}): string | null {
  return item.cardId ?? item.packId ?? item.soccerFieldId ?? item.premiumId;
}

/** Coins credited by mission rewards, for responses that report the balance after the event. */
export function missionRewardBalance(completed: readonly CompletedMission[]): number {
  return completed.reduce(
    (total, mission) => total + (mission.reward.type === 'balance' ? mission.reward.quantity : 0),
    0,
  );
}

async function missionTitles(
  database: Database,
  tx: Transaction,
  locale: string,
  titleIds: readonly string[],
): Promise<Map<string, string>> {
  const { and, inArray, schema } = database;
  if (titleIds.length === 0) return new Map();
  const translations = await tx
    .select({
      id: schema.localizedTextTranslations.localizedTextId,
      locale: schema.localizedTextTranslations.locale,
      content: schema.localizedTextTranslations.content,
    })
    .from(schema.localizedTextTranslations)
    .where(
      and(
        inArray(schema.localizedTextTranslations.locale, [locale, 'pt-BR']),
        inArray(schema.localizedTextTranslations.localizedTextId, [...titleIds]),
      ),
    );
  const titles = new Map<string, string>();
  for (const translation of translations)
    if (translation.locale === locale || !titles.has(translation.id))
      titles.set(translation.id, translation.content);
  return titles;
}

async function ensureCurrentMissions(
  database: Database,
  tx: Transaction,
  userId: string,
  now: Date,
): Promise<void> {
  const { and, eq, schema, sql } = database;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`missions:${userId}`}))`);
  const definitions = await tx
    .select({
      id: schema.missions.id,
      cadence: schema.missions.cadence,
      tier: schema.missions.tier,
    })
    .from(schema.missions)
    .where(eq(schema.missions.active, true))
    .orderBy(sql`random()`);
  const active = await tx
    .select({
      cadence: schema.userMissions.cadence,
      periodKey: schema.userMissions.periodKey,
      tier: schema.userMissions.tier,
    })
    .from(schema.userMissions)
    .where(
      and(eq(schema.userMissions.userId, userId), sql`${schema.userMissions.expiresAt} > ${now}`),
    );
  const assigned = new Set(
    active.map((mission) => `${mission.cadence}:${mission.periodKey}:${mission.tier}`),
  );

  for (const definition of definitions as MissionDefinition[]) {
    const cycle = missionCycle(definition.cadence, now);
    const slot = `${definition.cadence}:${cycle.key}:${definition.tier}`;
    if (assigned.has(slot)) continue;
    const reward = await tx
      .select({ itemId: schema.missionRewards.itemId })
      .from(schema.missionRewards)
      .where(
        and(
          eq(schema.missionRewards.missionId, definition.id),
          eq(schema.missionRewards.tier, definition.tier),
        ),
      )
      .orderBy(sql`random()`)
      .limit(1);
    const selectedReward = reward[0];
    if (!selectedReward) continue;
    await tx.insert(schema.userMissions).values({
      userId,
      missionId: definition.id,
      rewardItemId: selectedReward.itemId,
      cadence: definition.cadence,
      periodKey: cycle.key,
      tier: definition.tier,
      progress: 0,
      createdAt: now,
      expiresAt: cycle.expiresAt,
    });
    assigned.add(slot);
  }
}

export async function advanceMissions(
  database: Database,
  tx: Transaction,
  userId: string,
  type: MissionEventType,
  now: Date,
  increase = 1,
): Promise<CompletedMission[]> {
  if (!Number.isSafeInteger(increase) || increase < 0)
    throw new Error('Mission increase must not be negative.');
  if (increase === 0) return [];
  const { and, eq, schema, sql } = database;
  await ensureCurrentMissions(database, tx, userId, now);
  const missions = await tx
    .select({
      id: schema.userMissions.id,
      progress: schema.userMissions.progress,
      claimedAt: schema.userMissions.claimedAt,
      cadence: schema.userMissions.cadence,
      titleTextId: schema.missions.titleTextId,
      type: schema.missions.type,
      goal: schema.missions.goal,
      itemId: schema.items.id,
      itemType: schema.items.type,
      amount: schema.items.amount,
      cardId: schema.items.cardId,
      packId: schema.items.packId,
      soccerFieldId: schema.items.soccerFieldId,
      premiumId: schema.items.premiumId,
    })
    .from(schema.userMissions)
    .innerJoin(schema.missions, eq(schema.userMissions.missionId, schema.missions.id))
    .innerJoin(schema.items, eq(schema.userMissions.rewardItemId, schema.items.id))
    .where(
      and(
        eq(schema.userMissions.userId, userId),
        eq(schema.missions.type, type),
        sql`${schema.userMissions.expiresAt} > ${now}`,
      ),
    );

  const completed: Array<Omit<CompletedMission, 'title'> & { titleTextId: string; type: string }> =
    [];
  for (const mission of missions) {
    if (mission.claimedAt) continue;
    const progress = Math.min(mission.goal, mission.progress + increase);
    await tx
      .update(schema.userMissions)
      .set({ progress })
      .where(eq(schema.userMissions.id, mission.id));
    if (progress < mission.goal) continue;
    const reward = await grantReward(
      database,
      tx,
      userId,
      {
        itemId: mission.itemId,
        type: mission.itemType,
        amount: mission.amount,
        cardId: mission.cardId,
        packId: mission.packId,
        soccerFieldId: mission.soccerFieldId,
      },
      now,
      'mission',
    );
    await tx
      .update(schema.userMissions)
      .set({ claimedAt: now })
      .where(eq(schema.userMissions.id, mission.id));
    completed.push({
      id: mission.id,
      cadence: mission.cadence,
      titleTextId: mission.titleTextId,
      type: mission.type,
      reward,
    });
  }
  if (completed.length === 0) return [];
  const user = await tx.query.users.findFirst({
    columns: { language: true },
    where: eq(schema.users.id, userId),
  });
  const titles = await missionTitles(
    database,
    tx,
    user?.language ?? 'pt-BR',
    completed.map((mission) => mission.titleTextId),
  );
  return completed.map(({ titleTextId, type, ...mission }) => ({
    ...mission,
    title: titles.get(titleTextId) ?? type,
  }));
}

export class MissionsService {
  constructor(private readonly loadDatabase: DatabaseLoader) {}

  async list(identity: DiscordIdentity, now = new Date()): Promise<readonly MissionSummary[]> {
    const database = await this.loadDatabase();
    const { and, asc, eq, schema, sql } = database;
    return database.db.transaction(async (tx) => {
      const user = await upsertDiscordUser(tx, schema, identity, now);
      await ensureCurrentMissions(database, tx, user.id, now);
      const rows = await tx
        .select({
          id: schema.userMissions.id,
          titleTextId: schema.missions.titleTextId,
          type: schema.missions.type,
          cadence: schema.userMissions.cadence,
          tier: schema.userMissions.tier,
          goal: schema.missions.goal,
          progress: schema.userMissions.progress,
          claimedAt: schema.userMissions.claimedAt,
          expiresAt: schema.userMissions.expiresAt,
          itemId: schema.items.id,
          itemType: schema.items.type,
          amount: schema.items.amount,
          cardId: schema.items.cardId,
          packId: schema.items.packId,
          soccerFieldId: schema.items.soccerFieldId,
          premiumId: schema.items.premiumId,
        })
        .from(schema.userMissions)
        .innerJoin(schema.missions, eq(schema.userMissions.missionId, schema.missions.id))
        .leftJoin(schema.items, eq(schema.userMissions.rewardItemId, schema.items.id))
        .where(
          and(
            eq(schema.userMissions.userId, user.id),
            sql`${schema.userMissions.expiresAt} > ${now}`,
          ),
        )
        .orderBy(asc(schema.userMissions.expiresAt), asc(schema.userMissions.tier));
      const titles = await missionTitles(database, tx, user.language, [
        ...new Set(rows.map((row) => row.titleTextId)),
      ]);
      return rows.map((row) => ({
        id: row.id,
        title: titles.get(row.titleTextId) ?? row.type,
        type: row.type,
        cadence: row.cadence,
        tier: row.tier,
        goal: row.goal,
        progress: row.progress,
        completed: row.progress >= row.goal,
        claimed: row.claimedAt !== null,
        expiresAt: row.expiresAt,
        reward:
          row.itemId && row.itemType && row.amount !== null
            ? {
                itemId: row.itemId,
                type: row.itemType,
                quantity: row.amount,
                resourceId: itemResourceId(row),
              }
            : null,
      }));
    });
  }
}
