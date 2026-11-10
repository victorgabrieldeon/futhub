import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  type Transaction,
  isRedeemRewardType,
  rewardItemColumns,
  rewardResourceId,
  rewardResourceNames,
} from '../redeem-codes/repository/redeem-reward.js';
import {
  type AdminRewardInput,
  adminRewardItemValues,
  adminRewardOptions,
  assertAdminRewardResource,
} from '../rewards/admin-reward.js';
import type { AdminMission, AdminMissionInput, AdminMissionOptions } from './missions.dto.js';

type Database = typeof import('@futhub/database');

const adminLocale = 'pt-BR';

function rewardKey(reward: AdminRewardInput): string {
  return `${reward.type}:${reward.amount}:${reward.resourceId ?? ''}`;
}

@Injectable()
export class AdminMissionsService {
  async list(): Promise<AdminMission[]> {
    const database = await this.database();
    return database.db.transaction((tx) => this.read(database, tx));
  }

  async options(): Promise<AdminMissionOptions> {
    return adminRewardOptions(await this.database());
  }

  async create(input: AdminMissionInput): Promise<AdminMission> {
    const title = this.title(input);
    const database = await this.database();
    const { schema } = database;
    return database.db.transaction(async (tx) => {
      const [text] = await tx
        .insert(schema.localizedTexts)
        .values({})
        .returning({ id: schema.localizedTexts.id });
      if (!text) throw new Error('Failed to create mission title.');
      await tx
        .insert(schema.localizedTextTranslations)
        .values({ localizedTextId: text.id, locale: adminLocale, content: title });
      const [mission] = await tx
        .insert(schema.missions)
        .values({
          titleTextId: text.id,
          type: input.type,
          cadence: input.cadence,
          tier: input.tier,
          goal: input.goal,
          active: input.active,
        })
        .returning({ id: schema.missions.id });
      if (!mission) throw new Error('Failed to create mission.');
      await this.syncRewards(database, tx, mission.id, input, []);
      return this.readOne(database, tx, mission.id);
    });
  }

  async update(id: string, input: AdminMissionInput): Promise<AdminMission> {
    const title = this.title(input);
    const database = await this.database();
    const { eq, schema } = database;
    return database.db.transaction(async (tx) => {
      const current = await this.lock(database, tx, id);
      if (
        current.locked &&
        (current.type !== input.type ||
          current.cadence !== input.cadence ||
          current.tier !== input.tier ||
          current.goal !== input.goal)
      )
        throw new ConflictException(
          'Tipo, ciclo, tier e meta não podem mudar depois que a missão foi atribuída a jogadores.',
        );
      const [mission] = await tx
        .update(schema.missions)
        .set({
          type: input.type,
          cadence: input.cadence,
          tier: input.tier,
          goal: input.goal,
          active: input.active,
        })
        .where(eq(schema.missions.id, id))
        .returning({ titleTextId: schema.missions.titleTextId });
      if (!mission) throw new NotFoundException('Missão não encontrada.');
      const now = new Date();
      await tx
        .insert(schema.localizedTextTranslations)
        .values({ localizedTextId: mission.titleTextId, locale: adminLocale, content: title })
        .onConflictDoUpdate({
          target: [
            schema.localizedTextTranslations.localizedTextId,
            schema.localizedTextTranslations.locale,
          ],
          set: { content: title, updatedAt: now },
        });
      await this.syncRewards(database, tx, id, input, current.rewards);
      return this.readOne(database, tx, id);
    });
  }

  async remove(id: string): Promise<AdminMission> {
    const database = await this.database();
    const { eq, inArray, schema } = database;
    return database.db.transaction(async (tx) => {
      const current = await this.lock(database, tx, id);
      if (current.locked)
        throw new ConflictException(
          'Missões já atribuídas preservam o histórico dos jogadores; desative a missão em vez de excluí-la.',
        );
      const [mission] = await tx
        .delete(schema.missions)
        .where(eq(schema.missions.id, id))
        .returning({ titleTextId: schema.missions.titleTextId });
      if (!mission) throw new NotFoundException('Missão não encontrada.');
      const itemIds = current.rewards.map((reward) => reward.itemId);
      if (itemIds.length) await tx.delete(schema.items).where(inArray(schema.items.id, itemIds));
      await tx
        .delete(schema.localizedTexts)
        .where(eq(schema.localizedTexts.id, mission.titleTextId));
      return current;
    });
  }

  private title(input: AdminMissionInput): string {
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Informe o título da missão.');
    return title;
  }

  /**
   * Replaces the reward pool. Unchanged rewards keep their Item, so assignments already drawn
   * keep pointing at it; dropped Items are deleted only when no assignment references them.
   */
  private async syncRewards(
    database: Database,
    tx: Transaction,
    missionId: string,
    input: AdminMissionInput,
    current: AdminMission['rewards'],
  ): Promise<void> {
    const { eq, inArray, schema } = database;
    const keys = input.rewards.map(rewardKey);
    if (new Set(keys).size !== keys.length)
      throw new BadRequestException('A missão tem recompensas repetidas.');
    const existing = new Map(current.map((reward) => [rewardKey(reward), reward.itemId]));
    const itemIds: string[] = [];
    for (const reward of input.rewards) {
      const kept = existing.get(rewardKey(reward));
      if (kept) {
        itemIds.push(kept);
        continue;
      }
      await assertAdminRewardResource(database, tx, reward);
      const [item] = await tx
        .insert(schema.items)
        .values(adminRewardItemValues(reward))
        .returning({ id: schema.items.id });
      if (!item) throw new Error('Failed to create mission reward item.');
      itemIds.push(item.id);
    }
    await tx.delete(schema.missionRewards).where(eq(schema.missionRewards.missionId, missionId));
    await tx
      .insert(schema.missionRewards)
      .values(itemIds.map((itemId) => ({ missionId, itemId, tier: input.tier })));
    const dropped = current
      .map((reward) => reward.itemId)
      .filter((itemId) => !itemIds.includes(itemId));
    if (dropped.length === 0) return;
    const referenced = await tx
      .select({ itemId: schema.userMissions.rewardItemId })
      .from(schema.userMissions)
      .where(inArray(schema.userMissions.rewardItemId, dropped));
    const orphans = dropped.filter((itemId) => !referenced.some((row) => row.itemId === itemId));
    if (orphans.length) await tx.delete(schema.items).where(inArray(schema.items.id, orphans));
  }

  private async lock(database: Database, tx: Transaction, id: string): Promise<AdminMission> {
    const { eq, schema } = database;
    const [locked] = await tx
      .select({ id: schema.missions.id })
      .from(schema.missions)
      .where(eq(schema.missions.id, id))
      .for('update');
    if (!locked) throw new NotFoundException('Missão não encontrada.');
    return this.readOne(database, tx, id);
  }

  private async readOne(database: Database, tx: Transaction, id: string): Promise<AdminMission> {
    const [mission] = await this.read(database, tx, id);
    if (!mission) throw new NotFoundException('Missão não encontrada.');
    return mission;
  }

  private async read(database: Database, tx: Transaction, id?: string): Promise<AdminMission[]> {
    const { and, asc, eq, inArray, schema, sql } = database;
    const rows = await tx
      .select({
        id: schema.missions.id,
        title: schema.localizedTextTranslations.content,
        type: schema.missions.type,
        cadence: schema.missions.cadence,
        tier: schema.missions.tier,
        goal: schema.missions.goal,
        active: schema.missions.active,
        assignments: sql<number>`(select count(*)::int from ${schema.userMissions} where ${schema.userMissions.missionId} = ${schema.missions.id})`,
      })
      .from(schema.missions)
      .leftJoin(
        schema.localizedTextTranslations,
        and(
          eq(schema.localizedTextTranslations.localizedTextId, schema.missions.titleTextId),
          eq(schema.localizedTextTranslations.locale, adminLocale),
        ),
      )
      .where(id ? eq(schema.missions.id, id) : undefined)
      .orderBy(
        asc(schema.missions.cadence),
        asc(schema.missions.tier),
        asc(schema.localizedTextTranslations.content),
      );
    const rewards = rows.length
      ? await tx
          .select({ missionId: schema.missionRewards.missionId, ...rewardItemColumns(database) })
          .from(schema.missionRewards)
          .innerJoin(schema.items, eq(schema.missionRewards.itemId, schema.items.id))
          .where(
            inArray(
              schema.missionRewards.missionId,
              rows.map((row) => row.id),
            ),
          )
          .orderBy(asc(schema.items.type), asc(schema.items.amount))
      : [];
    const names = await rewardResourceNames(database, tx, rewards, adminLocale);
    return rows.map((row) => ({
      id: row.id,
      title: row.title ?? '',
      type: row.type,
      cadence: row.cadence,
      tier: row.tier,
      goal: row.goal,
      active: row.active,
      assignments: row.assignments,
      locked: row.assignments > 0,
      rewards: rewards
        .filter((reward) => reward.missionId === row.id)
        .map((reward) => {
          if (!isRedeemRewardType(reward.type))
            throw new Error(`Unsupported mission reward item type: ${reward.type}.`);
          const resourceId = rewardResourceId(reward);
          return {
            itemId: reward.itemId,
            type: reward.type,
            amount: reward.amount,
            resourceId,
            resourceName: resourceId ? (names.get(resourceId) ?? null) : null,
          };
        }),
    }));
  }

  private database(): Promise<Database> {
    return import('@futhub/database');
  }
}
