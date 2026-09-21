import type * as DatabaseModule from '@futhub/database';
import { BadRequestException, Injectable } from '@nestjs/common';

import { upsertDiscordUser } from '../users/user.repository.js';
import type { ClubRequest, ClubResponse } from './club.dto.js';

type Database = typeof DatabaseModule;
type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

export const MAX_STADIUM_LEVEL = 5;
export const SPONSOR_GOAL = 3;
export const SPONSOR_PAYOUT = 300;

export function stadiumUpgradeCost(level: number): number | null {
  return level >= MAX_STADIUM_LEVEL ? null : level * 1000;
}

export function startOfUtcWeek(now: Date): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

export async function ensureClub(
  database: Database,
  tx: Transaction,
  userId: string,
  now: Date,
): Promise<{ stadiumLevel: number }> {
  await tx.execute(database.sql`
    insert into user_clubs (user_id, created_at, updated_at)
    values (${userId}, ${now}, ${now})
    on conflict (user_id) do nothing
  `);
  const result = await tx.execute<{ stadiumLevel: number }>(database.sql`
    select stadium_level as "stadiumLevel" from user_clubs where user_id = ${userId}
  `);
  const club = result.rows[0];
  if (!club) throw new Error('Failed to load club.');
  return club;
}

export function calculateClubProjection(
  input: Readonly<{
    balance: number;
    stadiumLevel: number;
    weeklyMatches: number;
    payroll: number;
  }>,
): ClubResponse {
  const ticketRevenue = input.stadiumLevel * 200;
  const maintenance = input.stadiumLevel * 50;
  const sponsorCompleted = input.weeklyMatches >= SPONSOR_GOAL;
  return {
    balance: input.balance,
    stadium: {
      level: input.stadiumLevel,
      maxLevel: MAX_STADIUM_LEVEL,
      nextUpgradeCost: stadiumUpgradeCost(input.stadiumLevel),
      ticketRevenue,
      maintenance,
    },
    sponsor: {
      name: 'Comércio Local',
      weeklyMatches: input.weeklyMatches,
      weeklyGoal: SPONSOR_GOAL,
      payout: SPONSOR_PAYOUT,
      completed: sponsorCompleted,
    },
    payroll: input.payroll,
    projectedNet:
      ticketRevenue + (sponsorCompleted ? SPONSOR_PAYOUT : 0) - maintenance - input.payroll,
  };
}

export async function clubProjection(
  database: Database,
  tx: Transaction,
  userId: string,
  balance: number,
  stadiumLevel: number,
  now: Date,
): Promise<ClubResponse> {
  const { eq, schema, sql } = database;
  const [[matches], [payroll]] = await Promise.all([
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.rooms)
      .where(
        sql`${schema.rooms.completedAt} >= ${startOfUtcWeek(now)} and (${schema.rooms.homeUserId} = ${userId} or ${schema.rooms.awayUserId} = ${userId})`,
      ),
    tx
      .select({ total: sql<number>`coalesce(sum(${schema.cards.overall} / 10), 0)::int` })
      .from(schema.userCards)
      .innerJoin(schema.cards, eq(schema.userCards.cardId, schema.cards.id))
      .where(sql`${schema.userCards.userId} = ${userId} and ${schema.userCards.holder} = true`),
  ]);
  if (!matches || !payroll) throw new Error('Failed to calculate club economy.');

  return calculateClubProjection({
    balance,
    stadiumLevel,
    weeklyMatches: matches.count,
    payroll: payroll.total,
  });
}

@Injectable()
export class ClubService {
  async get(identity: ClubRequest, now = new Date()): Promise<ClubResponse> {
    const database = await import('@futhub/database');
    return database.db.transaction(async (tx) => {
      const user = await upsertDiscordUser(tx, database.schema, identity, now);
      const club = await ensureClub(database, tx, user.id, now);
      return clubProjection(database, tx, user.id, user.balance, club.stadiumLevel, now);
    });
  }

  async upgradeStadium(identity: ClubRequest, now = new Date()): Promise<ClubResponse> {
    const database = await import('@futhub/database');
    const { and, eq, gte, schema, sql } = database;
    return database.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`club:${identity.id}`}))`);
      const user = await upsertDiscordUser(tx, schema, identity, now);
      const club = await ensureClub(database, tx, user.id, now);
      const cost = stadiumUpgradeCost(club.stadiumLevel);
      if (cost === null) throw new BadRequestException('Stadium is already at maximum level.');

      const [charged] = await tx
        .update(schema.users)
        .set({ saldo: sql`${schema.users.saldo} - ${cost}`, atualizadoEm: now })
        .where(and(eq(schema.users.id, user.id), gte(schema.users.saldo, cost)))
        .returning({ balance: schema.users.saldo });
      if (!charged) throw new BadRequestException('Insufficient balance for stadium upgrade.');

      const upgradeResult = await tx.execute<{ stadiumLevel: number }>(sql`
        update user_clubs
        set stadium_level = ${club.stadiumLevel + 1}, updated_at = ${now}
        where user_id = ${user.id}
        returning stadium_level as "stadiumLevel"
      `);
      const upgraded = upgradeResult.rows[0];
      if (!upgraded) throw new Error('Failed to upgrade stadium.');
      await tx
        .insert(schema.transactionHistory)
        .values({ userId: user.id, type: 'purchase', amount: -cost, createdAt: now });
      return clubProjection(database, tx, user.id, charged.balance, upgraded.stadiumLevel, now);
    });
  }
}
