import { grantReward } from '../../progression/progression.js';
import { cardInventoryCapacity, upsertDiscordUser } from '../../users/user.repository.js';
import type {
  DiscordIdentity,
  RedeemCode,
  ResgatarCodigoRepository,
  ResgatarCodigoTransaction,
} from '../use-cases/resgatar-codigo/resgatar-codigo.types.js';
import {
  isRedeemRewardType,
  rewardItemColumns,
  rewardResourceId,
  rewardResourceNames,
} from './redeem-reward.js';

type Database = typeof import('@futhub/database');
type DatabaseLoader = () => Promise<Database>;

export class DrizzleResgatarCodigoRepository implements ResgatarCodigoRepository {
  constructor(private readonly loadDatabase: DatabaseLoader) {}

  async run<T>(
    identity: DiscordIdentity,
    now: Date,
    operation: (transaction: ResgatarCodigoTransaction) => Promise<T>,
  ): Promise<T> {
    const database = await this.loadDatabase();
    const { and, db, eq, schema, sql } = database;
    return db.transaction(async (tx) => {
      const user = await upsertDiscordUser(tx, schema, identity, now);
      const items = new Map<string, Parameters<typeof grantReward>[3]>();

      return operation({
        findCode: async (code) => {
          const [row] = await tx
            .select({
              id: schema.redeems.id,
              code: schema.redeems.code,
              active: schema.redeems.active,
              expiresAt: schema.redeems.expiresAt,
              maxClaims: schema.redeems.maxClaims,
              ...rewardItemColumns(database),
            })
            .from(schema.redeems)
            .innerJoin(schema.items, eq(schema.redeems.itemId, schema.items.id))
            .where(eq(schema.redeems.code, code))
            .for('update', { of: schema.redeems });
          if (!row) return null;
          if (!isRedeemRewardType(row.type))
            throw new Error(`Unsupported redeem code item type: ${row.type}.`);
          const [claims] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.redeemClaims)
            .where(eq(schema.redeemClaims.redeemId, row.id));
          const names = await rewardResourceNames(database, tx, [row], user.language);
          const resourceId = rewardResourceId(row);
          items.set(row.id, row);
          return {
            id: row.id,
            code: row.code,
            active: row.active,
            expiresAt: row.expiresAt,
            maxClaims: row.maxClaims,
            claims: claims?.count ?? 0,
            reward: {
              itemId: row.itemId,
              type: row.type,
              quantity: row.amount,
              resourceId,
              resourceName: resourceId ? (names.get(resourceId) ?? null) : null,
            },
          } satisfies RedeemCode;
        },
        hasRedeemed: async (redeemId) => {
          const claim = await tx.query.redeemClaims.findFirst({
            columns: { redeemId: true },
            where: and(
              eq(schema.redeemClaims.redeemId, redeemId),
              eq(schema.redeemClaims.userId, user.id),
            ),
          });
          return claim !== undefined;
        },
        canReceive: async (reward) => {
          if (reward.type !== 'card') return true;
          const inventory = await cardInventoryCapacity(database, tx, user.id);
          return inventory.cardCount + reward.quantity <= inventory.maxCards;
        },
        redeem: async (code) => {
          const item = items.get(code.id);
          if (!item) throw new Error('Redeem code must be loaded before redeeming.');
          await tx
            .insert(schema.redeemClaims)
            .values({ redeemId: code.id, userId: user.id, claimedAt: now });
          await grantReward(database, tx, user.id, item, now, 'redeem');
          const [balance] = await tx
            .select({ balance: schema.users.saldo })
            .from(schema.users)
            .where(eq(schema.users.id, user.id));
          if (!balance) throw new Error('Failed to load user balance.');
          return balance.balance;
        },
      });
    });
  }
}
