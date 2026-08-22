import type * as DatabaseModule from '@futhub/database';

import { grantReward } from '../progression/progression.js';
import { upsertDiscordUser } from '../users/user.repository.js';
import { type MissionCadence, missionCycle } from './mission-period.js';

export type DiscordIdentity = Readonly<{ id: string; name: string; avatarUrl: string | null }>;
export type MissionEventType = 'open_pack' | 'sell_player' | 'claim_profit' | 'play_match';
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
): Promise<void> {
  if (!Number.isSafeInteger(increase) || increase < 1)
    throw new Error('Mission increase must be positive.');
  const { and, eq, schema, sql } = database;
  await ensureCurrentMissions(database, tx, userId, now);
  const missions = await tx
    .select({
      id: schema.userMissions.id,
      progress: schema.userMissions.progress,
      claimedAt: schema.userMissions.claimedAt,
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

  for (const mission of missions) {
    if (mission.claimedAt) continue;
    const progress = Math.min(mission.goal, mission.progress + increase);
    await tx
      .update(schema.userMissions)
      .set({ progress })
      .where(eq(schema.userMissions.id, mission.id));
    if (progress < mission.goal) continue;
    await grantReward(
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
  }
}

export class MissionsService {
  constructor(private readonly loadDatabase: DatabaseLoader) {}

  async list(identity: DiscordIdentity, now = new Date()): Promise<readonly MissionSummary[]> {
    const database = await this.loadDatabase();
    const { and, asc, eq, inArray, schema, sql } = database;
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
      const titleIds = [...new Set(rows.map((row) => row.titleTextId))];
      const translations = titleIds.length
        ? await tx
            .select({
              id: schema.localizedTextTranslations.localizedTextId,
              content: schema.localizedTextTranslations.content,
            })
            .from(schema.localizedTextTranslations)
            .where(
              and(
                eq(schema.localizedTextTranslations.locale, user.language),
                inArray(schema.localizedTextTranslations.localizedTextId, titleIds),
              ),
            )
        : [];
      const titles = new Map(
        translations.map((translation) => [translation.id, translation.content]),
      );
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
