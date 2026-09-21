import type * as DatabaseModule from '@futhub/database';

import { type FilesService, imageFile } from '../files/files.service.js';
import { upsertDiscordUser } from '../users/user.repository.js';
import { type TeamCardImageInput, renderTeamCardImage } from './team-card-image.js';
import type {
  SetLineupCardRequest,
  TeamCard,
  TeamCollection,
  TeamFormation,
  TeamIdentity,
  TeamResponse,
  TeamTactic,
  TeamViewRequest,
} from './team.dto.js';

const pageSize = 10 as const;
type Database = typeof DatabaseModule;
type DatabaseLoader = () => Promise<Database>;
type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

export class TeamInputError extends Error {}

export function selectAutomaticLineup<Position extends string>(
  slots: readonly { position: Position }[],
  candidates: readonly {
    userCardId: string;
    overall: number;
    claimedAt: number;
    positions: readonly Position[];
  }[],
): { userCardId: string; position: Position }[] {
  const ordered = [...candidates].sort(
    (left, right) => right.overall - left.overall || left.claimedAt - right.claimedAt,
  );
  const owners: (number | undefined)[] = Array.from({ length: slots.length });
  const assign = (candidateIndex: number, visited: Set<number>): boolean => {
    const candidate = ordered[candidateIndex];
    if (!candidate) return false;
    for (const [slotIndex, slot] of slots.entries()) {
      if (visited.has(slotIndex) || !candidate.positions.includes(slot.position)) continue;
      visited.add(slotIndex);
      const owner = owners[slotIndex];
      if (owner === undefined || assign(owner, visited)) {
        owners[slotIndex] = candidateIndex;
        return true;
      }
    }
    return false;
  };
  for (const candidateIndex of ordered.keys()) assign(candidateIndex, new Set());
  return owners.flatMap((candidateIndex, slotIndex) => {
    const candidate = candidateIndex === undefined ? undefined : ordered[candidateIndex];
    const slot = slots[slotIndex];
    return candidate && slot ? [{ userCardId: candidate.userCardId, position: slot.position }] : [];
  });
}

export class TeamService {
  constructor(
    private readonly loadDatabase: DatabaseLoader,
    private readonly files: FilesService,
  ) {}

  async view(request: TeamViewRequest): Promise<TeamResponse> {
    const database = await this.loadDatabase();
    const user = await this.ensurePlayer(database, request.identity);
    return this.loadView(database, user.id, user.balance, request);
  }

  async setFormation(identity: TeamIdentity, formationId: string): Promise<void> {
    const database = await this.loadDatabase();
    const { db, eq, schema, sql } = database;
    await db.transaction(async (tx) => {
      const user = await upsertDiscordUser(tx, schema, identity, new Date());
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`team:${user.id}`}))`);
      const formation = await tx.query.formations.findFirst({
        columns: { id: true },
        where: eq(schema.formations.id, formationId),
      });
      if (!formation) throw new TeamInputError('Formação inválida.');
      await tx
        .insert(schema.userFormations)
        .values({ userId: user.id, formationId })
        .onConflictDoUpdate({
          target: schema.userFormations.userId,
          set: { formationId },
        });
      await this.autoLineup(tx, database, user.id, formationId);
    });
  }

  async setTactic(identity: TeamIdentity, tactic: TeamTactic): Promise<void> {
    const database = await this.loadDatabase();
    const { db, schema, sql } = database;
    await db.transaction(async (tx) => {
      const user = await upsertDiscordUser(tx, schema, identity, new Date());
      const formationId = await this.ensureFormation(tx, database, user.id);
      await tx.execute(sql`
        insert into user_formations (user_id, formation_id, tactic)
        values (${user.id}, ${formationId}, cast(${tactic} as team_tactic))
        on conflict (user_id) do update set tactic = excluded.tactic
      `);
    });
  }

  async autoSelect(identity: TeamIdentity): Promise<void> {
    const database = await this.loadDatabase();
    const { db, schema, sql } = database;
    await db.transaction(async (tx) => {
      const user = await upsertDiscordUser(tx, schema, identity, new Date());
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`team:${user.id}`}))`);
      const formationId = await this.ensureFormation(tx, database, user.id);
      await this.autoLineup(tx, database, user.id, formationId);
    });
  }

  async setLineupCard(request: SetLineupCardRequest): Promise<void> {
    const database = await this.loadDatabase();
    const { and, db, eq, schema, sql } = database;
    await db.transaction(async (tx) => {
      const user = await upsertDiscordUser(tx, schema, request.identity, new Date());
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`team:${user.id}`}))`);
      const formationId = await this.ensureFormation(tx, database, user.id);
      const slots = await tx.query.formationSlots.findMany({
        where: and(
          eq(schema.formationSlots.formationId, formationId),
          eq(schema.formationSlots.position, request.position),
        ),
      });
      if (slots.length === 0) throw new TeamInputError('A formação não possui esta posição.');

      const owned = await tx.query.userCards.findFirst({
        where: and(
          eq(schema.userCards.id, request.userCardId),
          eq(schema.userCards.userId, user.id),
        ),
      });
      if (!owned) throw new TeamInputError('Carta não encontrada no inventário.');
      const card = await tx.query.cards.findFirst({ where: eq(schema.cards.id, owned.cardId) });
      if (!card) throw new TeamInputError('Carta inválida.');
      const secondary = await tx.query.cardSecondaryPositions.findMany({
        where: eq(schema.cardSecondaryPositions.cardId, card.id),
      });
      if (
        card.position !== request.position &&
        !secondary.some(({ position }) => position === request.position)
      )
        throw new TeamInputError('Jogador incompatível com esta posição.');

      const holders = await tx.query.userCards.findMany({
        where: and(
          eq(schema.userCards.userId, user.id),
          eq(schema.userCards.holderPosition, request.position),
        ),
      });
      const others = holders.filter(({ id }) => id !== owned.id);
      if (others.length >= slots.length) {
        const ranked = await Promise.all(
          others.map(async (holder) => ({
            holder,
            card: await tx.query.cards.findFirst({ where: eq(schema.cards.id, holder.cardId) }),
          })),
        );
        const weakest = ranked.sort(
          (left, right) =>
            (left.card?.overall ?? 0) - (right.card?.overall ?? 0) ||
            right.holder.claimedAt.getTime() - left.holder.claimedAt.getTime(),
        )[0]?.holder;
        if (weakest)
          await tx
            .update(schema.userCards)
            .set({ holder: false, holderPosition: null, captain: false })
            .where(eq(schema.userCards.id, weakest.id));
      }
      await tx
        .update(schema.userCards)
        .set({ holder: true, holderPosition: request.position })
        .where(eq(schema.userCards.id, owned.id));
    });
  }

  async setCaptain(identity: TeamIdentity, userCardId: string): Promise<void> {
    const database = await this.loadDatabase();
    const { and, db, eq, schema, sql } = database;
    await db.transaction(async (tx) => {
      const user = await upsertDiscordUser(tx, schema, identity, new Date());
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`team:${user.id}`}))`);
      const holder = await tx.query.userCards.findFirst({
        where: and(
          eq(schema.userCards.id, userCardId),
          eq(schema.userCards.userId, user.id),
          eq(schema.userCards.holder, true),
        ),
      });
      if (!holder) throw new TeamInputError('O capitão precisa ser titular.');
      await tx
        .update(schema.userCards)
        .set({ captain: false })
        .where(eq(schema.userCards.userId, user.id));
      await tx
        .update(schema.userCards)
        .set({ captain: true })
        .where(eq(schema.userCards.id, holder.id));
    });
  }

  async toggleFavorite(identity: TeamIdentity, userCardId: string): Promise<void> {
    const database = await this.loadDatabase();
    const { and, db, eq, schema } = database;
    await db.transaction(async (tx) => {
      const user = await upsertDiscordUser(tx, schema, identity, new Date());
      const card = await tx.query.userCards.findFirst({
        where: and(eq(schema.userCards.id, userCardId), eq(schema.userCards.userId, user.id)),
      });
      if (!card) throw new TeamInputError('Carta não encontrada no inventário.');
      await tx
        .update(schema.userCards)
        .set({ favorite: !card.favorite })
        .where(eq(schema.userCards.id, card.id));
    });
  }

  private async ensurePlayer(database: Database, identity: TeamIdentity) {
    const { db, schema } = database;
    return db.transaction(async (tx) => {
      const user = await upsertDiscordUser(tx, schema, identity, new Date());
      await this.ensureFormation(tx, database, user.id);
      return user;
    });
  }

  private async ensureFormation(
    tx: Transaction,
    database: Database,
    userId: string,
  ): Promise<string> {
    const { eq, schema } = database;
    const selected = await tx.query.userFormations.findFirst({
      columns: { formationId: true },
      where: eq(schema.userFormations.userId, userId),
    });
    if (selected) return selected.formationId;
    const formation = await tx.query.formations.findFirst({ columns: { id: true } });
    if (!formation) throw new TeamInputError('Nenhuma formação está disponível.');
    await tx.insert(schema.userFormations).values({ userId, formationId: formation.id });
    return formation.id;
  }

  private async autoLineup(
    tx: Transaction,
    database: Database,
    userId: string,
    formationId: string,
  ): Promise<void> {
    const { and, eq, schema } = database;
    const [slots, ownedCards] = await Promise.all([
      tx.query.formationSlots.findMany({
        where: eq(schema.formationSlots.formationId, formationId),
      }),
      tx.query.userCards.findMany({ where: eq(schema.userCards.userId, userId) }),
    ]);
    const candidates = await Promise.all(
      ownedCards.map(async (owned) => {
        const [card, secondary] = await Promise.all([
          tx.query.cards.findFirst({ where: eq(schema.cards.id, owned.cardId) }),
          tx.query.cardSecondaryPositions.findMany({
            where: eq(schema.cardSecondaryPositions.cardId, owned.cardId),
          }),
        ]);
        if (!card) throw new TeamInputError('Carta inválida no inventário.');
        return {
          userCardId: owned.id,
          overall: card.overall,
          claimedAt: owned.claimedAt.getTime(),
          positions: [card.position, ...secondary.map(({ position }) => position)],
        };
      }),
    );
    const assignments = selectAutomaticLineup(
      [...slots].sort((left, right) => left.y - right.y || left.x - right.x),
      candidates,
    );
    const captainId = ownedCards.find(({ captain }) => captain)?.id;
    await tx
      .update(schema.userCards)
      .set({ holder: false, holderPosition: null, captain: false })
      .where(eq(schema.userCards.userId, userId));
    for (const assignment of assignments)
      await tx
        .update(schema.userCards)
        .set({
          holder: true,
          holderPosition: assignment.position,
          captain: assignment.userCardId === captainId,
        })
        .where(
          and(eq(schema.userCards.id, assignment.userCardId), eq(schema.userCards.userId, userId)),
        );
  }

  private async loadView(
    database: Database,
    userId: string,
    balance: number,
    request: TeamViewRequest,
  ): Promise<TeamResponse> {
    const { and, asc, db, eq, gte, schema } = database;
    const translationJoin = and(
      eq(schema.localizedTextTranslations.localizedTextId, schema.collections.nameTextId),
      eq(schema.localizedTextTranslations.locale, 'pt-BR'),
    );
    const [selected, formationRows, slotRows, rows, marketConfig, packs] = await Promise.all([
      db.query.userFormations.findFirst({
        where: eq(schema.userFormations.userId, userId),
      }),
      db
        .select({
          id: schema.formations.id,
          name: schema.localizedTextTranslations.content,
        })
        .from(schema.formations)
        .leftJoin(
          schema.localizedTextTranslations,
          and(
            eq(schema.localizedTextTranslations.localizedTextId, schema.formations.nameTextId),
            eq(schema.localizedTextTranslations.locale, 'pt-BR'),
          ),
        )
        .orderBy(asc(schema.localizedTextTranslations.content), asc(schema.formations.id)),
      db.select().from(schema.formationSlots),
      db
        .select({
          userCardId: schema.userCards.id,
          cardId: schema.cards.id,
          name: schema.cards.name,
          imageFileId: schema.cards.imageFileId,
          legacyImageUrl: schema.cards.imageUrl,
          overall: schema.cards.overall,
          position: schema.cards.position,
          teamName: schema.teams.name,
          collectionId: schema.collections.id,
          collectionName: schema.localizedTextTranslations.content,
          collectionEmoji: schema.collections.emoji,
          primaryColor: schema.collections.primaryColor,
          secondaryColor: schema.collections.secondaryColor,
          pace: schema.cardStats.pace,
          finishing: schema.cardStats.finishing,
          passing: schema.cardStats.passing,
          dribbling: schema.cardStats.dribbling,
          marking: schema.cardStats.marking,
          control: schema.cardStats.control,
          favorite: schema.userCards.favorite,
          holder: schema.userCards.holder,
          holderPosition: schema.userCards.holderPosition,
          captain: schema.userCards.captain,
          claimedAt: schema.userCards.claimedAt,
          basePrice: schema.cardPriceConfigs.price,
        })
        .from(schema.userCards)
        .innerJoin(schema.cards, eq(schema.userCards.cardId, schema.cards.id))
        .innerJoin(schema.cardStats, eq(schema.cards.statsId, schema.cardStats.id))
        .innerJoin(schema.teams, eq(schema.cards.teamId, schema.teams.id))
        .innerJoin(schema.collections, eq(schema.cards.collectionId, schema.collections.id))
        .leftJoin(schema.localizedTextTranslations, translationJoin)
        .leftJoin(
          schema.cardPriceConfigs,
          eq(schema.cards.overall, schema.cardPriceConfigs.overall),
        )
        .where(eq(schema.userCards.userId, userId)),
      db.query.cardMarketConfig.findFirst(),
      db
        .select({
          id: schema.packs.id,
          name: schema.packs.name,
          emoji: schema.packs.emoji,
          quantity: schema.userPacks.quantity,
        })
        .from(schema.userPacks)
        .innerJoin(schema.packs, eq(schema.userPacks.packId, schema.packs.id))
        .where(and(eq(schema.userPacks.userId, userId), gte(schema.userPacks.quantity, 1)))
        .orderBy(asc(schema.packs.name), asc(schema.packs.id)),
    ]);
    if (!selected) throw new TeamInputError('Formação não selecionada.');

    const formations: TeamFormation[] = formationRows.map((formation, index) => ({
      id: formation.id,
      name: formation.name ?? `Formação ${index + 1}`,
      slots: slotRows
        .filter(({ formationId }) => formationId === formation.id)
        .sort((left, right) => left.y - right.y || left.x - right.x)
        .map(({ id, position, x, y }) => ({ id, position, x, y })),
    }));
    const formation = formations.find(({ id }) => id === selected.formationId);
    if (!formation) throw new TeamInputError('Formação selecionada não está disponível.');

    const secondary = new Map<string, TeamCard['secondaryPositions']>();
    for (const row of rows) {
      const owned = await db.query.userCards.findFirst({
        columns: { cardId: true },
        where: eq(schema.userCards.id, row.userCardId),
      });
      if (!owned) continue;
      const positions = await db.query.cardSecondaryPositions.findMany({
        where: eq(schema.cardSecondaryPositions.cardId, owned.cardId),
      });
      secondary.set(
        row.userCardId,
        positions.map(({ position }) => position),
      );
    }
    const [imageUrls, generatedImageUrls] = await Promise.all([
      this.files.urls(rows.flatMap(({ imageFileId }) => (imageFileId ? [imageFileId] : []))),
      this.ensureCardImages(database, rows),
    ]);
    const multiplier = marketConfig?.sellMultiplierBasisPoints ?? 0;
    const cards: TeamCard[] = rows.map((row) => ({
      userCardId: row.userCardId,
      name: row.name,
      imageUrl:
        (row.imageFileId ? imageUrls.get(row.imageFileId) : undefined) ??
        row.legacyImageUrl ??
        generatedImageUrls.get(row.cardId) ??
        null,
      overall: row.overall,
      position: row.position,
      secondaryPositions: secondary.get(row.userCardId) ?? [],
      collection: {
        id: row.collectionId,
        name: row.collectionName ?? 'Sem coleção',
        emoji: row.collectionEmoji,
      },
      favorite: row.favorite,
      holder: row.holder,
      holderPosition: row.holderPosition,
      captain: row.captain,
      sellPrice: Math.floor(((row.basePrice ?? 0) * multiplier) / 10_000),
      claimedAt: row.claimedAt.toISOString(),
    }));
    const collections = [
      ...new Map(cards.map((card) => [card.collection.id, card.collection])).values(),
    ].sort((left, right) => left.name.localeCompare(right.name)) as TeamCollection[];
    const name = request.name.toLocaleLowerCase('pt-BR');
    const filtered = cards
      .filter((card) => !name || card.name.toLocaleLowerCase('pt-BR').includes(name))
      .filter(
        (card) =>
          !request.position ||
          card.position === request.position ||
          card.secondaryPositions.includes(request.position),
      )
      .filter((card) => !request.collectionId || card.collection.id === request.collectionId)
      .sort((left, right) => {
        if (request.sort === 'name') return left.name.localeCompare(right.name);
        if (request.sort === 'recent') return right.claimedAt.localeCompare(left.claimedAt);
        return right.overall - left.overall || left.name.localeCompare(right.name);
      });
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(request.page, totalPages);
    const lineup = cards
      .filter(({ holder }) => holder)
      .sort(
        (left, right) =>
          formation.slots.findIndex(({ position }) => position === left.holderPosition) -
            formation.slots.findIndex(({ position }) => position === right.holderPosition) ||
          right.overall - left.overall,
      );
    return {
      balance,
      strength: lineup.reduce((total, card) => total + card.overall, 0),
      inventoryCount: cards.length,
      tactic: (selected as typeof selected & { tactic: TeamTactic }).tactic,
      formation,
      formations,
      lineup,
      inventory: {
        items: filtered.slice((page - 1) * pageSize, page * pageSize),
        total: filtered.length,
        page,
        pageSize,
        totalPages,
      },
      packs,
      collections,
    };
  }

  private async ensureCardImages(
    database: Database,
    rows: readonly (Omit<TeamCardImageInput, 'collectionName' | 'stats'> & {
      cardId: string;
      imageFileId: string | null;
      legacyImageUrl: string | null;
      collectionName: string | null;
      pace: number;
      finishing: number;
      passing: number;
      dribbling: number;
      marking: number;
      control: number;
    })[],
  ): Promise<Map<string, string>> {
    const missing = [
      ...new Map(
        rows
          .filter((row) => !row.imageFileId && !row.legacyImageUrl)
          .map((row) => [row.cardId, row]),
      ).values(),
    ];
    const generated = new Map<string, string>();
    for (const row of missing) {
      const url = await database.db.transaction(async (tx) => {
        await tx.execute(
          database.sql`select pg_advisory_xact_lock(hashtext(${`card-image:${row.cardId}`}))`,
        );
        const current = await tx.query.cards.findFirst({
          columns: { imageFileId: true, imageUrl: true },
          where: database.eq(database.schema.cards.id, row.cardId),
        });
        if (!current) throw new Error('Card not found while generating its image.');
        if (current.imageFileId) {
          return (await this.files.urls([current.imageFileId])).get(current.imageFileId) ?? null;
        }
        if (current.imageUrl) return current.imageUrl;

        const buffer = await renderTeamCardImage({
          ...row,
          collectionName: row.collectionName ?? 'Sem colecao',
          stats: {
            pace: row.pace,
            finishing: row.finishing,
            passing: row.passing,
            dribbling: row.dribbling,
            marking: row.marking,
            control: row.control,
          },
        });
        const file = await this.files.generated(imageFile(buffer, 'image/png'));
        await tx
          .update(database.schema.cards)
          .set({ imageFileId: file.id })
          .where(database.eq(database.schema.cards.id, row.cardId));
        return file.url;
      });
      if (!url) throw new Error('Generated card image URL is unavailable.');
      generated.set(row.cardId, url);
    }
    return generated;
  }
}
