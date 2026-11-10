import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  adminRewardItemValues,
  adminRewardOptions,
  assertAdminRewardResource,
} from '../rewards/admin-reward.js';
import { normalizeRedeemCode } from './redeem-code.js';
import type {
  AdminRedeemCode,
  AdminRedeemCodeInput,
  AdminRedeemCodeOptions,
} from './redeem-codes.dto.js';
import {
  type Transaction,
  isRedeemRewardType,
  rewardItemColumns,
  rewardResourceId,
  rewardResourceNames,
} from './repository/redeem-reward.js';

type Database = typeof import('@futhub/database');

const adminLocale = 'pt-BR';

@Injectable()
export class AdminRedeemCodesService {
  async list(): Promise<AdminRedeemCode[]> {
    const database = await this.database();
    return database.db.transaction((tx) => this.read(database, tx));
  }

  async options(): Promise<AdminRedeemCodeOptions> {
    return adminRewardOptions(await this.database());
  }

  async create(input: AdminRedeemCodeInput): Promise<AdminRedeemCode> {
    const code = this.code(input.code);
    const database = await this.database();
    const { schema } = database;
    return database.db.transaction(async (tx) => {
      await assertAdminRewardResource(database, tx, input.reward);
      await this.assertAvailable(database, tx, code, null);
      const [item] = await tx
        .insert(schema.items)
        .values(adminRewardItemValues(input.reward))
        .returning({ id: schema.items.id });
      if (!item) throw new Error('Failed to create redeem code item.');
      const [redeem] = await tx
        .insert(schema.redeems)
        .values({
          code,
          itemId: item.id,
          maxClaims: input.maxClaims,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          active: input.active,
        })
        .returning({ id: schema.redeems.id });
      if (!redeem) throw new Error('Failed to create redeem code.');
      return this.readOne(database, tx, redeem.id);
    });
  }

  async update(id: string, input: AdminRedeemCodeInput): Promise<AdminRedeemCode> {
    const code = this.code(input.code);
    const database = await this.database();
    const { eq, schema } = database;
    return database.db.transaction(async (tx) => {
      const current = await this.lock(database, tx, id);
      const rewardChanged =
        current.reward.type !== input.reward.type ||
        current.reward.amount !== input.reward.amount ||
        current.reward.resourceId !== input.reward.resourceId;
      if (current.locked && (current.code !== code || rewardChanged))
        throw new ConflictException(
          'Código e recompensa não podem mudar depois do primeiro resgate.',
        );
      if (input.maxClaims !== null && input.maxClaims < current.claims)
        throw new BadRequestException(
          `O limite de resgates não pode ser menor que os ${current.claims} já realizados.`,
        );
      if (rewardChanged) {
        await assertAdminRewardResource(database, tx, input.reward);
        await tx
          .update(schema.items)
          .set(adminRewardItemValues(input.reward))
          .where(eq(schema.items.id, current.reward.itemId));
      }
      if (current.code !== code) await this.assertAvailable(database, tx, code, id);
      await tx
        .update(schema.redeems)
        .set({
          code,
          maxClaims: input.maxClaims,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          active: input.active,
        })
        .where(eq(schema.redeems.id, id));
      return this.readOne(database, tx, id);
    });
  }

  async remove(id: string): Promise<AdminRedeemCode> {
    const database = await this.database();
    const { eq, schema } = database;
    return database.db.transaction(async (tx) => {
      const current = await this.lock(database, tx, id);
      if (current.locked)
        throw new ConflictException(
          'Códigos já resgatados preservam o histórico; desative o código em vez de excluí-lo.',
        );
      await tx.delete(schema.redeems).where(eq(schema.redeems.id, id));
      await tx.delete(schema.items).where(eq(schema.items.id, current.reward.itemId));
      return current;
    });
  }

  private code(value: string): string {
    const code = normalizeRedeemCode(value);
    if (!code)
      throw new BadRequestException(
        'O código deve ter de 3 a 32 caracteres: letras, números, hífen ou sublinhado.',
      );
    return code;
  }

  private async assertAvailable(
    database: Database,
    tx: Transaction,
    code: string,
    id: string | null,
  ): Promise<void> {
    const existing = await tx.query.redeems.findFirst({
      columns: { id: true },
      where: database.eq(database.schema.redeems.code, code),
    });
    if (existing && existing.id !== id)
      throw new ConflictException(`Já existe um código de resgate ${code}.`);
  }

  private async lock(database: Database, tx: Transaction, id: string): Promise<AdminRedeemCode> {
    const { eq, schema } = database;
    const [locked] = await tx
      .select({ id: schema.redeems.id })
      .from(schema.redeems)
      .where(eq(schema.redeems.id, id))
      .for('update');
    if (!locked) throw new NotFoundException('Código de resgate não encontrado.');
    return this.readOne(database, tx, id);
  }

  private async readOne(database: Database, tx: Transaction, id: string): Promise<AdminRedeemCode> {
    const [redeem] = await this.read(database, tx, id);
    if (!redeem) throw new NotFoundException('Código de resgate não encontrado.');
    return redeem;
  }

  private async read(database: Database, tx: Transaction, id?: string): Promise<AdminRedeemCode[]> {
    const { desc, eq, schema, sql } = database;
    const rows = await tx
      .select({
        id: schema.redeems.id,
        code: schema.redeems.code,
        active: schema.redeems.active,
        maxClaims: schema.redeems.maxClaims,
        expiresAt: schema.redeems.expiresAt,
        createdAt: schema.redeems.createdAt,
        claims: sql<number>`(select count(*)::int from ${schema.redeemClaims} where ${schema.redeemClaims.redeemId} = ${schema.redeems.id})`,
        ...rewardItemColumns(database),
      })
      .from(schema.redeems)
      .innerJoin(schema.items, eq(schema.redeems.itemId, schema.items.id))
      .where(id ? eq(schema.redeems.id, id) : undefined)
      .orderBy(desc(schema.redeems.createdAt), desc(schema.redeems.code));
    const names = await rewardResourceNames(database, tx, rows, adminLocale);
    return rows.map((row) => {
      if (!isRedeemRewardType(row.type))
        throw new Error(`Unsupported redeem code item type: ${row.type}.`);
      const resourceId = rewardResourceId(row);
      return {
        id: row.id,
        code: row.code,
        active: row.active,
        maxClaims: row.maxClaims,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        claims: row.claims,
        locked: row.claims > 0,
        reward: {
          itemId: row.itemId,
          type: row.type,
          amount: row.amount,
          resourceId,
          resourceName: resourceId ? (names.get(resourceId) ?? null) : null,
        },
      };
    });
  }

  private database(): Promise<Database> {
    return import('@futhub/database');
  }
}
