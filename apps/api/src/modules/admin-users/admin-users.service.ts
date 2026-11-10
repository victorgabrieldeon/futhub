import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { getXpForLevel } from '../progression/progression.js';
import { adminRewardOptions } from '../rewards/admin-reward.js';
import { cardInventoryCapacity } from '../users/user.repository.js';
import type {
  AdminUserBalanceInput,
  AdminUserCardsInput,
  AdminUserDetail,
  AdminUserListQuery,
  AdminUserOptions,
  AdminUserPackInput,
  AdminUserPage,
  AdminUserProfileInput,
  AdminUserSummary,
} from './admin-users.dto.js';

type Database = typeof import('@futhub/database');
type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

const adminLocale = 'pt-BR';
const transactionLimit = 50;

@Injectable()
export class AdminUsersService {
  async list(query: AdminUserListQuery): Promise<AdminUserPage> {
    const database = await this.database();
    const { desc, schema, sql } = database;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const search = query.query?.trim();
    const pattern = search ? `%${search.replace(/[\\%_]/g, '\\$&')}%` : '';
    const filter = search
      ? sql<boolean>`(${schema.users.nome} ILIKE ${pattern} OR ${schema.users.discordUserId} = ${search} OR ${schema.users.id}::text = ${search})`
      : undefined;
    const [rows, count] = await Promise.all([
      database.db
        .select(this.summaryColumns(database))
        .from(schema.users)
        .where(filter)
        .orderBy(desc(schema.users.atualizadoEm), desc(schema.users.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      database.db.select({ count: sql<number>`count(*)::int` }).from(schema.users).where(filter),
    ]);
    return {
      items: rows.map((row) => this.summary(row)),
      total: count[0]?.count ?? 0,
      page,
      pageSize,
    };
  }

  async options(): Promise<AdminUserOptions> {
    return adminRewardOptions(await this.database());
  }

  async detail(id: string): Promise<AdminUserDetail> {
    const database = await this.database();
    return database.db.transaction((tx) => this.read(database, tx, id));
  }

  async updateProfile(id: string, input: AdminUserProfileInput): Promise<AdminUserDetail> {
    if (input.xp >= getXpForLevel(input.level))
      throw new BadRequestException(
        `No nível ${input.level} o XP deve ser menor que ${getXpForLevel(input.level)}.`,
      );
    const database = await this.database();
    const { eq, schema } = database;
    return database.db.transaction(async (tx) => {
      await this.lock(database, tx, id);
      await tx
        .update(schema.users)
        .set({ ...input, atualizadoEm: new Date() })
        .where(eq(schema.users.id, id));
      return this.read(database, tx, id);
    });
  }

  async adjustBalance(id: string, input: AdminUserBalanceInput): Promise<AdminUserDetail> {
    const database = await this.database();
    const { eq, schema, sql } = database;
    return database.db.transaction(async (tx) => {
      const user = await this.lock(database, tx, id);
      if (user.balance + input.amount < 0)
        throw new BadRequestException(
          `O saldo atual é ${user.balance}; o ajuste deixaria o saldo negativo.`,
        );
      await tx
        .update(schema.users)
        .set({ saldo: sql`${schema.users.saldo} + ${input.amount}`, atualizadoEm: new Date() })
        .where(eq(schema.users.id, id));
      await tx
        .insert(schema.transactionHistory)
        .values({ userId: id, type: 'admin', amount: input.amount });
      return this.read(database, tx, id);
    });
  }

  async addCards(id: string, input: AdminUserCardsInput): Promise<AdminUserDetail> {
    const database = await this.database();
    const { eq, schema } = database;
    return database.db.transaction(async (tx) => {
      await this.lock(database, tx, id);
      const [card] = await tx
        .select({ id: schema.cards.id })
        .from(schema.cards)
        .where(eq(schema.cards.id, input.cardId));
      if (!card) throw new NotFoundException('Card não encontrado.');
      const inventory = await cardInventoryCapacity(database, tx, id);
      if (inventory.cardCount + input.quantity > inventory.maxCards)
        throw new ConflictException(
          `O inventário comporta ${inventory.maxCards} cards e o usuário já tem ${inventory.cardCount}.`,
        );
      const now = new Date();
      await tx.insert(schema.userCards).values(
        Array.from({ length: input.quantity }, () => ({
          userId: id,
          cardId: input.cardId,
          claimedBy: 'admin' as const,
          claimedAt: now,
        })),
      );
      return this.read(database, tx, id);
    });
  }

  async removeCard(id: string, userCardId: string): Promise<AdminUserDetail> {
    const database = await this.database();
    const { and, eq, schema } = database;
    return database.db.transaction(async (tx) => {
      await this.lock(database, tx, id);
      const [owned] = await tx
        .select({ id: schema.userCards.id })
        .from(schema.userCards)
        .where(and(eq(schema.userCards.id, userCardId), eq(schema.userCards.userId, id)))
        .for('update');
      if (!owned) throw new NotFoundException('Card não pertence a este usuário.');
      const [traded] = await tx
        .select({ tradeId: schema.tradeCards.tradeId })
        .from(schema.tradeCards)
        .where(eq(schema.tradeCards.userCardId, userCardId))
        .limit(1);
      if (traded)
        throw new ConflictException('Cards que participaram de trocas preservam o histórico.');
      await tx.delete(schema.userCards).where(eq(schema.userCards.id, userCardId));
      return this.read(database, tx, id);
    });
  }

  async setPack(id: string, packId: string, input: AdminUserPackInput): Promise<AdminUserDetail> {
    const database = await this.database();
    const { and, eq, schema } = database;
    return database.db.transaction(async (tx) => {
      await this.lock(database, tx, id);
      const [pack] = await tx
        .select({ id: schema.packs.id })
        .from(schema.packs)
        .where(eq(schema.packs.id, packId));
      if (!pack) throw new NotFoundException('Pack não encontrado.');
      if (input.quantity === 0)
        await tx
          .delete(schema.userPacks)
          .where(and(eq(schema.userPacks.userId, id), eq(schema.userPacks.packId, packId)));
      else
        await tx
          .insert(schema.userPacks)
          .values({ userId: id, packId, quantity: input.quantity })
          .onConflictDoUpdate({
            target: [schema.userPacks.userId, schema.userPacks.packId],
            set: { quantity: input.quantity },
          });
      return this.read(database, tx, id);
    });
  }

  async grantField(id: string, fieldId: string): Promise<AdminUserDetail> {
    const database = await this.database();
    const { eq, schema } = database;
    return database.db.transaction(async (tx) => {
      await this.lock(database, tx, id);
      const [field] = await tx
        .select({ id: schema.soccerFields.id })
        .from(schema.soccerFields)
        .where(eq(schema.soccerFields.id, fieldId));
      if (!field) throw new NotFoundException('Campo não encontrado.');
      await tx
        .insert(schema.userSoccerFields)
        .values({ userId: id, soccerFieldId: fieldId })
        .onConflictDoNothing();
      return this.read(database, tx, id);
    });
  }

  async revokeField(id: string, fieldId: string): Promise<AdminUserDetail> {
    const database = await this.database();
    const { and, eq, schema } = database;
    return database.db.transaction(async (tx) => {
      await this.lock(database, tx, id);
      await tx
        .delete(schema.userSoccerFields)
        .where(
          and(
            eq(schema.userSoccerFields.userId, id),
            eq(schema.userSoccerFields.soccerFieldId, fieldId),
          ),
        );
      return this.read(database, tx, id);
    });
  }

  /** Serializes admin edits with gameplay writes, which upsert (and so lock) the same row. */
  private async lock(
    database: Database,
    tx: Transaction,
    id: string,
  ): Promise<{ id: string; balance: number }> {
    const { eq, schema } = database;
    const [user] = await tx
      .select({ id: schema.users.id, balance: schema.users.saldo })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .for('update');
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  private async read(database: Database, tx: Transaction, id: string): Promise<AdminUserDetail> {
    const { and, asc, desc, eq, schema, sql } = database;
    const [user] = await tx
      .select({ ...this.summaryColumns(database), language: schema.users.language })
      .from(schema.users)
      .where(eq(schema.users.id, id));
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    const [inventory, club, cards, packs, fields, transactions] = await Promise.all([
      cardInventoryCapacity(database, tx, id),
      tx
        .select({ stadiumLevel: schema.userClubs.stadiumLevel })
        .from(schema.userClubs)
        .where(eq(schema.userClubs.userId, id)),
      tx
        .select({
          id: schema.userCards.id,
          cardId: schema.cards.id,
          name: schema.cards.name,
          overall: schema.cards.overall,
          position: schema.cards.position,
          holder: schema.userCards.holder,
          captain: schema.userCards.captain,
          favorite: schema.userCards.favorite,
          inTrade: sql<boolean>`exists(select 1 from ${schema.tradeCards} where ${schema.tradeCards}.${sql.identifier('user_card_id')} = ${schema.userCards}.${sql.identifier('id')})`,
          claimedBy: schema.userCards.claimedBy,
          claimedAt: schema.userCards.claimedAt,
        })
        .from(schema.userCards)
        .innerJoin(schema.cards, eq(schema.userCards.cardId, schema.cards.id))
        .where(eq(schema.userCards.userId, id))
        .orderBy(
          desc(schema.cards.overall),
          asc(schema.cards.name),
          desc(schema.userCards.claimedAt),
        ),
      tx
        .select({
          packId: schema.packs.id,
          name: schema.packs.name,
          quantity: schema.userPacks.quantity,
        })
        .from(schema.userPacks)
        .innerJoin(schema.packs, eq(schema.userPacks.packId, schema.packs.id))
        .where(eq(schema.userPacks.userId, id))
        .orderBy(asc(schema.packs.name)),
      tx
        .select({
          fieldId: schema.soccerFields.id,
          name: schema.localizedTextTranslations.content,
        })
        .from(schema.userSoccerFields)
        .innerJoin(
          schema.soccerFields,
          eq(schema.userSoccerFields.soccerFieldId, schema.soccerFields.id),
        )
        .innerJoin(
          schema.localizedTextTranslations,
          and(
            eq(schema.localizedTextTranslations.localizedTextId, schema.soccerFields.nameTextId),
            eq(schema.localizedTextTranslations.locale, adminLocale),
          ),
        )
        .where(eq(schema.userSoccerFields.userId, id))
        .orderBy(asc(schema.localizedTextTranslations.content)),
      tx
        .select({
          id: schema.transactionHistory.id,
          type: schema.transactionHistory.type,
          amount: schema.transactionHistory.amount,
          createdAt: schema.transactionHistory.createdAt,
        })
        .from(schema.transactionHistory)
        .where(eq(schema.transactionHistory.userId, id))
        .orderBy(desc(schema.transactionHistory.createdAt), desc(schema.transactionHistory.id))
        .limit(transactionLimit),
    ]);
    return {
      ...this.summary(user),
      language: user.language,
      nextLevelXp: getXpForLevel(user.level),
      maxCards: inventory.maxCards,
      stadiumLevel: club[0]?.stadiumLevel ?? null,
      cards: cards.map((card) => ({ ...card, claimedAt: card.claimedAt.toISOString() })),
      packs,
      fields,
      transactions: transactions.map((transaction) => ({
        ...transaction,
        createdAt: transaction.createdAt.toISOString(),
      })),
    };
  }

  private summaryColumns(database: Database) {
    const { schema, sql } = database;
    return {
      id: schema.users.id,
      discordUserId: schema.users.discordUserId,
      name: schema.users.nome,
      avatarUrl: schema.users.urlAvatar,
      balance: schema.users.saldo,
      level: schema.users.level,
      xp: schema.users.xp,
      booster: schema.users.booster,
      banned: schema.users.banned,
      // Qualified on purpose: an unqualified "id" would resolve to user_cards.id inside the subquery.
      cardCount: sql<number>`(select count(*)::int from ${schema.userCards} where ${schema.userCards}.${sql.identifier('user_id')} = ${schema.users}.${sql.identifier('id')})`,
      createdAt: schema.users.criadoEm,
      updatedAt: schema.users.atualizadoEm,
    };
  }

  private summary(
    row: {
      createdAt: Date;
      updatedAt: Date;
    } & Omit<AdminUserSummary, 'createdAt' | 'updatedAt'>,
  ): AdminUserSummary {
    return {
      id: row.id,
      discordUserId: row.discordUserId,
      name: row.name,
      avatarUrl: row.avatarUrl,
      balance: row.balance,
      level: row.level,
      xp: row.xp,
      booster: row.booster,
      banned: row.banned,
      cardCount: row.cardCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private database(): Promise<Database> {
    return import('@futhub/database');
  }
}
