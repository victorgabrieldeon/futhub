import { randomUUID } from 'node:crypto';
import type * as DatabaseModule from '@futhub/database';

type Database = typeof DatabaseModule;
type DiscordIdentity = Readonly<{ id: string; name: string; avatarUrl: string | null }>;

const formationPositions = [
  'GOL',
  'LD',
  'LE',
  'ZAG',
  'ZAG',
  'VOL',
  'MC',
  'MA',
  'PD',
  'PE',
  'CA',
] as const;

export async function createFileFixture(database: Database, objectKey: string) {
  const [file] = await database.db
    .insert(database.schema.files)
    .values({ objectKey, contentType: 'image/png', sizeBytes: 1, source: 'upload', metadata: {} })
    .returning();
  if (!file) throw new Error('Failed to create test file.');
  return file;
}

export async function createAdminCardFixture(
  database: Database,
  input: Readonly<{
    slug: string;
    name: string;
    collectionId: string;
    teamId: string;
    overall: number;
  }>,
) {
  const [statistics] = await database.db
    .insert(database.schema.cardStats)
    .values({ passing: 80, control: 80, marking: 80, pace: 80, dribbling: 80, finishing: 80 })
    .returning({ id: database.schema.cardStats.id });
  if (!statistics) throw new Error('Missing card statistics.');
  const image = await createFileFixture(database, `cards/${input.slug}/image.png`);
  const [card] = await database.db
    .insert(database.schema.cards)
    .values({
      ...input,
      position: 'CA',
      statsId: statistics.id,
      imageFileId: image.id,
      defense: 80,
      attack: 80,
      creation: 80,
    })
    .returning({ id: database.schema.cards.id });
  if (!card) throw new Error('Missing test card.');
  return card;
}

export async function createUser(
  database: Database,
  identity: DiscordIdentity,
  balance = 0,
): Promise<{ id: string }> {
  const [user] = await database.db
    .insert(database.schema.users)
    .values({
      discordUserId: identity.id,
      nome: identity.name,
      urlAvatar: identity.avatarUrl,
      saldo: balance,
    })
    .returning({ id: database.schema.users.id });
  if (!user) throw new Error('Failed to create test user.');
  return user;
}

export async function createCardCatalog(
  database: Database,
  name: string,
): Promise<{
  collectionId: string;
  teamId: string;
}> {
  const suffix = randomUUID();
  const [text] = await database.db
    .insert(database.schema.localizedTexts)
    .values({})
    .returning({ id: database.schema.localizedTexts.id });
  const textId = text?.id;
  if (!textId) throw new Error('Failed to create test text.');
  await database.db.insert(database.schema.localizedTextTranslations).values({
    localizedTextId: textId,
    locale: 'pt-BR',
    content: `${name} collection ${suffix}`,
  });
  const [collection] = await database.db
    .insert(database.schema.collections)
    .values({
      slug: `${name}-collection-${suffix}`,
      nameTextId: textId,
      emoji: '⚽',
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
    })
    .returning({ id: database.schema.collections.id });
  const [team] = await database.db
    .insert(database.schema.teams)
    .values({
      slug: `${name}-team-${suffix}`,
      name: `${name} team ${suffix}`,
      emoji: '⚽',
      color: '#000000',
    })
    .returning({ id: database.schema.teams.id });
  if (!collection || !team) throw new Error('Failed to create test card catalog.');
  return { collectionId: collection.id, teamId: team.id };
}

async function createCard(
  database: Database,
  catalog: { collectionId: string; teamId: string },
  name: string,
  position: (typeof formationPositions)[number],
  input: Readonly<{
    overall?: number;
    createdAt?: Date;
    imageFileId?: string;
    secondaryPositions?: readonly (typeof formationPositions)[number][];
  }> = {},
): Promise<{ id: string }> {
  const [stats] = await database.db
    .insert(database.schema.cardStats)
    .values({ passing: 80, control: 80, marking: 80, pace: 80, dribbling: 80, finishing: 80 })
    .returning({ id: database.schema.cardStats.id });
  if (!stats) throw new Error('Failed to create test card statistics.');
  const [card] = await database.db
    .insert(database.schema.cards)
    .values({
      slug: `test-${randomUUID()}`,
      name,
      collectionId: catalog.collectionId,
      teamId: catalog.teamId,
      statsId: stats.id,
      position,
      imageFileId: input.imageFileId,
      defense: 80,
      attack: 80,
      creation: 80,
      overall: input.overall ?? 80,
      createdAt: input.createdAt,
    })
    .returning({ id: database.schema.cards.id });
  if (!card) throw new Error('Failed to create test card.');
  if (input.secondaryPositions?.length) {
    await database.db.insert(database.schema.cardSecondaryPositions).values(
      input.secondaryPositions.map((secondaryPosition) => ({
        cardId: card.id,
        position: secondaryPosition,
      })),
    );
  }
  return card;
}

export async function createAdminPackFixture(database: Database): Promise<{
  id: string;
  configId: string;
  userId: string;
}> {
  const user = await createUser(database, {
    id: `pack-owner-${randomUUID()}`,
    name: 'Pack owner',
    avatarUrl: null,
  });
  const [config] = await database.db
    .insert(database.schema.packConfigs)
    .values({ name: 'Fixture config', minOverall: 70, maxOverall: 90 })
    .returning({ id: database.schema.packConfigs.id });
  if (!config) throw new Error('Failed to create pack config fixture.');
  const [pack] = await database.db
    .insert(database.schema.packs)
    .values({
      name: 'Fixture pack',
      color: '#111111',
      emoji: 'fixture',
      cardsAmount: 3,
      price: 10,
      canBuy: true,
      limitPerUser: 2,
      configId: config.id,
    })
    .returning({ id: database.schema.packs.id });
  if (!pack) throw new Error('Failed to create pack fixture.');
  await database.db
    .insert(database.schema.userPacks)
    .values({ userId: user.id, packId: pack.id, quantity: 1 });
  return { id: pack.id, configId: config.id, userId: user.id };
}

export async function createPackFixture(
  database: Database,
): Promise<{ packId: string; cardId: string }> {
  const catalog = await createCardCatalog(database, 'pack');
  const card = await createCard(database, catalog, 'Pack card', 'CA');
  const [config] = await database.db
    .insert(database.schema.packConfigs)
    .values({ name: `pack ${randomUUID()}`, minOverall: 80, maxOverall: 80 })
    .returning({ id: database.schema.packConfigs.id });
  if (!config) throw new Error('Failed to create test pack config.');
  const [pack] = await database.db
    .insert(database.schema.packs)
    .values({
      name: 'E2E pack',
      configId: config.id,
      color: '#000000',
      emoji: '📦',
      cardsAmount: 1,
      price: 20,
    })
    .returning({ id: database.schema.packs.id });
  const [probability] = await database.db
    .insert(database.schema.packProbabilities)
    .values({ name: `e2e ${randomUUID()}`, overall: 80, probability: 1 })
    .returning({ id: database.schema.packProbabilities.id });
  if (!pack || !probability) throw new Error('Failed to create test pack.');
  await database.db.insert(database.schema.packProbabilityLinks).values({
    packId: pack.id,
    probabilityId: probability.id,
  });
  return { packId: pack.id, cardId: card.id };
}

export async function createCardMarketFixture(database: Database): Promise<{
  cardId: string;
  blockedCardId: string;
  collectionId: string;
  teamId: string;
  secondaryPositionCardId: string;
  eligibleCardIds: readonly string[];
}> {
  const catalog = await createCardCatalog(database, 'market');
  const image = await createFileFixture(database, `cards/market-${randomUUID()}.png`);
  const card = await createCard(database, catalog, 'Market card', 'CA', {
    imageFileId: image.id,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
  });
  const eligibleCards = [card];
  for (let index = 0; index < 13; index++) {
    eligibleCards.push(
      await createCard(
        database,
        catalog,
        index < 2 ? 'Market tie' : `Market ${String(index).padStart(2, '0')}`,
        'MC',
        {
          overall: index < 2 ? 90 : index < 5 ? 85 : 80,
          imageFileId: index === 12 ? undefined : image.id,
          createdAt: new Date(Date.UTC(2025, 0, index + 2)),
          secondaryPositions: index === 0 ? ['MA'] : index === 1 ? ['CA'] : [],
        },
      ),
    );
  }
  const blockedCard = await createCard(database, catalog, 'Blocked market card', 'CA');
  await database.db
    .update(database.schema.cards)
    .set({ contractsBlocked: true })
    .where(database.eq(database.schema.cards.id, blockedCard.id));
  const blockedCatalog = await createCardCatalog(database, 'blocked-market');
  await database.db
    .update(database.schema.collections)
    .set({ contractsBlocked: true })
    .where(database.eq(database.schema.collections.id, blockedCatalog.collectionId));
  await createCard(database, blockedCatalog, 'Blocked collection card', 'CA');
  await createCard(database, catalog, 'Missing price card', 'CA', { overall: 99 });
  for (const price of [
    { overall: 80, price: 100 },
    { overall: 85, price: 150 },
    { overall: 90, price: 200 },
  ]) {
    await database.db
      .insert(database.schema.cardPriceConfigs)
      .values(price)
      .onConflictDoUpdate({
        target: database.schema.cardPriceConfigs.overall,
        set: { price: price.price },
      });
  }
  await database.db
    .delete(database.schema.cardPriceConfigs)
    .where(database.eq(database.schema.cardPriceConfigs.overall, 99));
  await database.db
    .insert(database.schema.cardMarketConfig)
    .values({
      singleton: true,
      buyMultiplierBasisPoints: 20_000,
      sellMultiplierBasisPoints: 2_000,
    })
    .onConflictDoUpdate({
      target: database.schema.cardMarketConfig.singleton,
      set: { buyMultiplierBasisPoints: 20_000, sellMultiplierBasisPoints: 2_000 },
    });
  return {
    cardId: card.id,
    blockedCardId: blockedCard.id,
    collectionId: catalog.collectionId,
    teamId: catalog.teamId,
    secondaryPositionCardId: eligibleCards[1]?.id ?? card.id,
    eligibleCardIds: eligibleCards.map((eligibleCard) => eligibleCard.id),
  };
}

export async function createLeaguePlayer(
  database: Database,
  identity: DiscordIdentity,
  input: Readonly<{ holderCount?: number }> = {},
): Promise<{ id: string }> {
  const user = await createUser(database, identity);
  const catalog = await createCardCatalog(database, identity.id);
  const [text] = await database.db
    .insert(database.schema.localizedTexts)
    .values({})
    .returning({ id: database.schema.localizedTexts.id });
  const textId = text?.id;
  if (!textId) throw new Error('Failed to create test formation text.');
  await database.db.insert(database.schema.localizedTextTranslations).values({
    localizedTextId: textId,
    locale: 'pt-BR',
    content: `4-3-3 ${identity.id}`,
  });
  const [formation] = await database.db
    .insert(database.schema.formations)
    .values({ nameTextId: textId })
    .returning({ id: database.schema.formations.id });
  if (!formation) throw new Error('Failed to create test formation.');
  await database.db.insert(database.schema.formationSlots).values(
    formationPositions.map((position, index) => ({
      formationId: formation.id,
      position,
      x: index,
      y: 0,
    })),
  );
  await database.db.insert(database.schema.userFormations).values({
    userId: user.id,
    formationId: formation.id,
  });
  for (const [index, position] of formationPositions
    .slice(0, input.holderCount ?? formationPositions.length)
    .entries()) {
    const card = await createCard(database, catalog, `${identity.name} ${index}`, position);
    await database.db.insert(database.schema.userCards).values({
      userId: user.id,
      cardId: card.id,
      holder: true,
      holderPosition: position,
    });
  }
  return user;
}

export async function createTeamPlayer(database: Database, identity: DiscordIdentity) {
  const user = await createLeaguePlayer(database, identity);
  const catalog = await createCardCatalog(database, `${identity.id}-reserve`);
  const reserve = await createCard(database, catalog, `${identity.name} Reserva`, 'CA', {
    overall: 95,
    secondaryPositions: ['MA'],
  });
  const [owned] = await database.db
    .insert(database.schema.userCards)
    .values({ userId: user.id, cardId: reserve.id })
    .returning({ id: database.schema.userCards.id });
  if (!owned) throw new Error('Failed to create reserve card.');
  const [packConfig] = await database.db
    .insert(database.schema.packConfigs)
    .values({ name: `team-pack-${randomUUID()}`, minOverall: 80, maxOverall: 90 })
    .returning({ id: database.schema.packConfigs.id });
  if (!packConfig) throw new Error('Failed to create team pack config.');
  const [pack] = await database.db
    .insert(database.schema.packs)
    .values({
      name: 'Pack do time',
      configId: packConfig.id,
      color: '#111111',
      emoji: '📦',
      cardsAmount: 3,
      price: 10,
    })
    .returning({ id: database.schema.packs.id });
  if (!pack) throw new Error('Failed to create team pack.');
  await database.db
    .insert(database.schema.userPacks)
    .values({ userId: user.id, packId: pack.id, quantity: 2 });
  await database.db
    .insert(database.schema.cardPriceConfigs)
    .values([
      { overall: 80, price: 100 },
      { overall: 95, price: 200 },
    ])
    .onConflictDoNothing();
  await database.db
    .insert(database.schema.cardMarketConfig)
    .values({ singleton: true, sellMultiplierBasisPoints: 2_000 })
    .onConflictDoNothing();
  const formation = await database.db.query.userFormations.findFirst({
    columns: { formationId: true },
    where: database.eq(database.schema.userFormations.userId, user.id),
  });
  if (!formation) throw new Error('Failed to load test formation.');
  return {
    userId: user.id,
    reserveCardId: reserve.id,
    reserveUserCardId: owned.id,
    packId: pack.id,
    formationId: formation.formationId,
  };
}

export async function createBotResponseMigrationFixture(database: Database) {
  const embed = {
    title: '  Original title  ',
    description: 'Original **{message}**\n{reward} {balance}',
    color: '#aAbBcC',
    footer: '  {availableAt}  ',
  };
  await database.db
    .insert(database.schema.commandConfigs)
    .values({ commandName: 'lucro', cooldownSeconds: 123, embed });
  await database.db
    .delete(database.schema.botResponseTemplates)
    .where(database.eq(database.schema.botResponseTemplates.key, 'lucro.success'));
  return embed;
}

export async function createPackShopFixture(database: Database) {
  const ids: string[] = [];
  for (let index = 0; index < 7; index++) {
    const pack = await createAdminPackFixture(database);
    await database.db
      .update(database.schema.packs)
      .set({
        name: `Shop ${index}`,
        canBuy: index < 6,
        imageUrl: index === 0 ? 'https://example.com/pack.png' : null,
      })
      .where(database.eq(database.schema.packs.id, pack.id));
    ids.push(pack.id);
  }
  return ids;
}
