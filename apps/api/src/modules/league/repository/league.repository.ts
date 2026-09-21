import type * as DatabaseModule from '@futhub/database';

import { fileUrl } from '../../files/files.service.js';
import { advanceMissions } from '../../missions/missions.service.js';
import { upsertDiscordUser } from '../../users/user.repository.js';
import type {
  LeagueStatusResponse,
  MatchEventDto,
  MatchResponse,
  QueueResponse,
} from '../league.dto.js';
import { simulateMatch, validateLineup } from '../use-cases/league/league.simulator.js';
import type { LineupCard, TeamTactic } from '../use-cases/league/league.types.js';
import {
  type DiscordIdentity,
  LeagueInputError,
  LeagueNotFoundError,
  type LeagueRepository,
} from '../use-cases/league/league.use-case.types.js';

type Database = typeof DatabaseModule;
type DatabaseLoader = () => Promise<Database>;
type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

export class DrizzleLeagueRepository implements LeagueRepository {
  constructor(private readonly loadDatabase: DatabaseLoader) {}

  async join(identity: DiscordIdentity): Promise<QueueResponse> {
    const database = await this.loadDatabase();
    const now = new Date();
    const { and, db, eq, schema, sql } = database;
    const current = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`ranked-user:${identity.id}`}))`,
      );
      const user = await upsertDiscordUser(tx, schema, identity, now);
      const bronze = await tx.query.divisions.findFirst({
        columns: { id: true },
        where: eq(schema.divisions.name, 'Bronze'),
      });
      if (!bronze) throw new Error('Bronze division is missing.');
      const [standing] = await tx
        .insert(schema.userLeagueStandings)
        .values({ userId: user.id, divisionId: bronze.id })
        .onConflictDoNothing()
        .returning();
      const persisted =
        standing ??
        (await tx.query.userLeagueStandings.findFirst({
          where: eq(schema.userLeagueStandings.userId, user.id),
        }));
      if (!persisted) throw new Error('Failed to load league standing.');
      return { userId: user.id, standing: persisted };
    });

    const ownQueue = await db.query.rankedQueues.findFirst({
      columns: { status: true, roomId: true },
      where: eq(schema.rankedQueues.userId, current.userId),
    });
    if (ownQueue?.status === 'matched' && ownQueue.roomId)
      return { kind: 'matched', matchId: ownQueue.roomId };

    const division = await db.query.divisions.findFirst({
      columns: { id: true, name: true, points: true, emoji: true, color: true, imageFileId: true },
      where: eq(schema.divisions.id, current.standing.divisionId),
    });
    if (!division) throw new Error('Standing division is missing.');
    const ownLineup = await this.loadLineup(database, current.userId);

    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`ranked-division:${current.standing.divisionId}`}))`,
      );
      const queued = await tx.query.rankedQueues.findFirst({
        columns: { userId: true },
        where: and(
          eq(schema.rankedQueues.divisionId, current.standing.divisionId),
          eq(schema.rankedQueues.status, 'waiting'),
        ),
      });
      if (!queued) {
        await tx
          .insert(schema.rankedQueues)
          .values({
            userId: current.userId,
            divisionId: current.standing.divisionId,
            status: 'waiting',
            roomId: null,
            queuedAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.rankedQueues.userId,
            set: {
              divisionId: current.standing.divisionId,
              status: 'waiting',
              roomId: null,
              queuedAt: now,
              updatedAt: now,
            },
          });
        return {
          kind: 'waiting',
          division: {
            id: division.id,
            name: division.name,
            minimumPoints: division.points,
            emoji: division.emoji,
            color: division.color,
            imageUrl: await this.imageUrl(database, division.imageFileId),
          },
        };
      }

      const homeLineup = await this.loadLineup(database, queued.userId);
      const seed = Math.floor(Math.random() * 2_147_483_647) + 1;
      const simulated = simulateMatch(
        homeLineup.cards,
        ownLineup.cards,
        seed,
        homeLineup.tactic,
        ownLineup.tactic,
      );
      const [room] = await tx
        .insert(schema.rooms)
        .values({
          homeUserId: queued.userId,
          awayUserId: current.userId,
          seed,
          homeGoals: simulated.homeGoals,
          awayGoals: simulated.awayGoals,
          completedAt: now,
          createdAt: now,
        })
        .returning({ id: schema.rooms.id });
      if (!room) throw new Error('Failed to create match.');
      await tx.insert(schema.roomMatchEvents).values(
        simulated.events.map((event, index) => ({
          roomId: room.id,
          sequence: index + 1,
          minute: event.minute,
          type: event.type,
          playerUserCardId: event.playerUserCardId,
          assistUserCardId: event.assistUserCardId,
          description: event.description,
          homeGoals: event.homeGoals,
          awayGoals: event.awayGoals,
        })),
      );
      await tx
        .update(schema.rankedQueues)
        .set({ status: 'matched', roomId: room.id, updatedAt: now })
        .where(sql`${schema.rankedQueues.userId} in (${queued.userId}, ${current.userId})`);
      await this.recordCardStatistics(
        tx,
        schema,
        sql,
        [...homeLineup.cards, ...ownLineup.cards],
        simulated.events,
      );
      const homeStanding = await tx.query.userLeagueStandings.findFirst({
        where: eq(schema.userLeagueStandings.userId, queued.userId),
      });
      if (!homeStanding) throw new Error('Home standing is missing.');
      await this.recordStanding(
        tx,
        schema,
        database,
        queued.userId,
        homeStanding,
        simulated.homeGoals,
        simulated.awayGoals,
        now,
      );
      await this.recordStanding(
        tx,
        schema,
        database,
        current.userId,
        current.standing,
        simulated.awayGoals,
        simulated.homeGoals,
        now,
      );
      await advanceMissions(database, tx, queued.userId, 'play_match', now);
      await advanceMissions(database, tx, current.userId, 'play_match', now);
      return { kind: 'matched', matchId: room.id };
    });
  }

  async status(discordUserId: string): Promise<QueueResponse | null> {
    const database = await this.loadDatabase();
    const { db, eq, schema } = database;
    const user = await db.query.users.findFirst({
      columns: { id: true },
      where: eq(schema.users.discordUserId, discordUserId),
    });
    if (!user) throw new LeagueNotFoundError('Player not found.');
    const queue = await db.query.rankedQueues.findFirst({
      where: eq(schema.rankedQueues.userId, user.id),
    });
    if (!queue) return null;
    if (queue.status === 'matched' && queue.roomId)
      return { kind: 'matched', matchId: queue.roomId };
    const division = await db.query.divisions.findFirst({
      where: eq(schema.divisions.id, queue.divisionId),
    });
    if (!division) throw new Error('Queue division is missing.');
    return {
      kind: 'waiting',
      division: {
        id: division.id,
        name: division.name,
        minimumPoints: division.points,
        emoji: division.emoji,
        color: division.color,
        imageUrl: await this.imageUrl(database, division.imageFileId),
      },
    };
  }

  async standings(discordUserId: string): Promise<LeagueStatusResponse> {
    const database = await this.loadDatabase();
    const { db, eq, schema } = database;
    const user = await db.query.users.findFirst({
      columns: { id: true },
      where: eq(schema.users.discordUserId, discordUserId),
    });
    if (!user) throw new LeagueNotFoundError('Player not found.');
    const standing = await db.query.userLeagueStandings.findFirst({
      where: eq(schema.userLeagueStandings.userId, user.id),
    });
    if (!standing) throw new LeagueNotFoundError('League standing not found.');
    const division = await db.query.divisions.findFirst({
      where: eq(schema.divisions.id, standing.divisionId),
    });
    if (!division) throw new Error('Standing division is missing.');
    return {
      points: standing.points,
      wins: standing.wins,
      draws: standing.draws,
      losses: standing.losses,
      division: {
        id: division.id,
        name: division.name,
        minimumPoints: division.points,
        emoji: division.emoji,
        color: division.color,
        imageUrl: await this.imageUrl(database, division.imageFileId),
      },
      queue: await this.status(discordUserId),
    };
  }

  async match(matchId: string): Promise<MatchResponse> {
    const { db, eq, schema } = await this.loadDatabase();
    const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, matchId) });
    if (!room) throw new LeagueNotFoundError('Match not found.');
    return {
      id: room.id,
      homeUserId: room.homeUserId,
      awayUserId: room.awayUserId,
      homeGoals: room.homeGoals,
      awayGoals: room.awayGoals,
      completedAt: room.completedAt.toISOString(),
      events: await this.events(matchId),
    };
  }

  async events(matchId: string): Promise<MatchEventDto[]> {
    const { db, eq, schema } = await this.loadDatabase();
    const room = await db.query.rooms.findFirst({
      columns: { id: true },
      where: eq(schema.rooms.id, matchId),
    });
    if (!room) throw new LeagueNotFoundError('Match not found.');
    const events = await db.query.roomMatchEvents.findMany({
      where: eq(schema.roomMatchEvents.roomId, room.id),
    });
    return events
      .sort((left, right) => left.sequence - right.sequence)
      .map((event) => ({ ...event }));
  }

  private async loadLineup(
    database: Database,
    userId: string,
  ): Promise<{ cards: LineupCard[]; tactic: TeamTactic }> {
    const { and, db, eq, schema } = database;
    const formation = await db.query.userFormations.findFirst({
      where: eq(schema.userFormations.userId, userId),
    });
    if (!formation) throw new LeagueInputError('Player has no selected formation.');
    const slots = await db.query.formationSlots.findMany({
      where: eq(schema.formationSlots.formationId, formation.formationId),
    });
    const holders = await db.query.userCards.findMany({
      where: and(eq(schema.userCards.userId, userId), eq(schema.userCards.holder, true)),
    });
    const cards = await Promise.all(
      holders.map(async (holder) => {
        const card = await db.query.cards.findFirst({ where: eq(schema.cards.id, holder.cardId) });
        if (!card || !holder.holderPosition) throw new LeagueInputError('Holder card is invalid.');
        const stats = await db.query.cardStats.findFirst({
          where: eq(schema.cardStats.id, card.statsId),
        });
        if (!stats) throw new LeagueInputError('Holder statistics are missing.');
        const secondary = await db.query.cardSecondaryPositions.findMany({
          where: eq(schema.cardSecondaryPositions.cardId, card.id),
        });
        return {
          userCardId: holder.id,
          name: card.name,
          assignedPosition: holder.holderPosition,
          allowedPositions: [card.position, ...secondary.map((position) => position.position)],
          attack: card.attack,
          creation: card.creation,
          defense: card.defense,
          finishing: stats.finishing,
          passing: stats.passing,
          control: stats.control,
          marking: stats.marking,
        };
      }),
    );
    validateLineup(
      cards,
      slots.map((slot) => slot.position),
    );
    return {
      cards,
      tactic: (formation as typeof formation & { tactic: TeamTactic }).tactic,
    };
  }

  private async recordCardStatistics(
    tx: Transaction,
    schema: Database['schema'],
    sql: Database['sql'],
    cards: readonly LineupCard[],
    events: readonly {
      type: string;
      playerUserCardId: string | null;
      assistUserCardId: string | null;
    }[],
  ): Promise<void> {
    const contributions = new Map<
      string,
      { goals: number; assists: number; yellowCards: number; redCards: number }
    >();
    for (const card of cards)
      contributions.set(card.userCardId, { goals: 0, assists: 0, yellowCards: 0, redCards: 0 });
    for (const event of events) {
      const player = event.playerUserCardId ? contributions.get(event.playerUserCardId) : undefined;
      if (player && event.type === 'goal') player.goals += 1;
      if (player && event.type === 'yellow_card') player.yellowCards += 1;
      if (player && event.type === 'red_card') player.redCards += 1;
      const assistant = event.assistUserCardId
        ? contributions.get(event.assistUserCardId)
        : undefined;
      if (assistant && event.type === 'goal') assistant.assists += 1;
    }
    for (const [userCardId, statistics] of contributions) {
      await tx
        .update(schema.userCards)
        .set({
          matches: sql`${schema.userCards.matches} + 1`,
          goals: sql`${schema.userCards.goals} + ${statistics.goals}`,
          assists: sql`${schema.userCards.assists} + ${statistics.assists}`,
          yellowCards: sql`${schema.userCards.yellowCards} + ${statistics.yellowCards}`,
          redCards: sql`${schema.userCards.redCards} + ${statistics.redCards}`,
        })
        .where(sql`${schema.userCards.id} = ${userCardId}`);
    }
  }

  private async recordStanding(
    tx: Transaction,
    schema: Database['schema'],
    database: Database,
    userId: string,
    standing: { points: number; wins: number; draws: number; losses: number },
    goals: number,
    opponentGoals: number,
    now: Date,
  ): Promise<void> {
    const outcome = goals > opponentGoals ? 'win' : goals < opponentGoals ? 'loss' : 'draw';
    const points = standing.points + (outcome === 'win' ? 3 : outcome === 'draw' ? 1 : 0);
    const divisions = await database.db.query.divisions.findMany();
    const division = divisions
      .filter((candidate) => candidate.points <= points)
      .sort((left, right) => right.points - left.points)[0];
    if (!division) throw new Error('No division accepts current points.');
    await tx
      .update(schema.userLeagueStandings)
      .set({
        points,
        divisionId: division.id,
        wins: standing.wins + (outcome === 'win' ? 1 : 0),
        draws: standing.draws + (outcome === 'draw' ? 1 : 0),
        losses: standing.losses + (outcome === 'loss' ? 1 : 0),
        updatedAt: now,
      })
      .where(database.eq(schema.userLeagueStandings.userId, userId));
  }

  private async imageUrl(database: Database, fileId: string | null): Promise<string | null> {
    if (!fileId) return null;
    const [file] = await database.db
      .select({ objectKey: database.schema.files.objectKey })
      .from(database.schema.files)
      .where(database.eq(database.schema.files.id, fileId));
    return file ? fileUrl(file.objectKey) : null;
  }
}
