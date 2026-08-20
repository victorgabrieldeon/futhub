import { randomUUID } from 'node:crypto';
import type * as DatabaseModule from '@dreamfut/database';

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

async function createCardCatalog(
  database: Database,
  name: string,
): Promise<{
  collectionId: string;
  teamId: string;
  nationalityId: string;
}> {
  const suffix = randomUUID();
  const [text] = await database.db
    .insert(database.schema.localizedTexts)
    .values({})
    .returning({ id: database.schema.localizedTexts.id });
  const textId = text?.id;
  if (!textId) throw new Error('Failed to create test text.');
  const [collection] = await database.db
    .insert(database.schema.collections)
    .values({
      nameTextId: textId,
      emoji: '⚽',
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
    })
    .returning({ id: database.schema.collections.id });
  const [team] = await database.db
    .insert(database.schema.teams)
    .values({ name: `${name} team ${suffix}`, emoji: '⚽', color: '#000000' })
    .returning({ id: database.schema.teams.id });
  const [nationality] = await database.db
    .insert(database.schema.nationalities)
    .values({ name: `${name} nationality ${suffix}`, emoji: '🇧🇷', color: '#000000' })
    .returning({ id: database.schema.nationalities.id });
  if (!collection || !team || !nationality) throw new Error('Failed to create test card catalog.');
  return { collectionId: collection.id, teamId: team.id, nationalityId: nationality.id };
}

async function createCard(
  database: Database,
  catalog: { collectionId: string; teamId: string; nationalityId: string },
  name: string,
  position: (typeof formationPositions)[number],
): Promise<{ id: string }> {
  const [stats] = await database.db
    .insert(database.schema.cardStats)
    .values({ passing: 80, control: 80, marking: 80, pace: 80, dribbling: 80, finishing: 80 })
    .returning({ id: database.schema.cardStats.id });
  if (!stats) throw new Error('Failed to create test card statistics.');
  const [card] = await database.db
    .insert(database.schema.cards)
    .values({
      name,
      collectionId: catalog.collectionId,
      teamId: catalog.teamId,
      nationalityId: catalog.nationalityId,
      statsId: stats.id,
      position,
      defense: 80,
      attack: 80,
      creation: 80,
      overall: 80,
    })
    .returning({ id: database.schema.cards.id });
  if (!card) throw new Error('Failed to create test card.');
  return card;
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

export async function createLeaguePlayer(
  database: Database,
  identity: DiscordIdentity,
): Promise<{ id: string }> {
  const user = await createUser(database, identity);
  const catalog = await createCardCatalog(database, identity.id);
  const [text] = await database.db
    .insert(database.schema.localizedTexts)
    .values({})
    .returning({ id: database.schema.localizedTexts.id });
  const textId = text?.id;
  if (!textId) throw new Error('Failed to create test formation text.');
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
  for (const [index, position] of formationPositions.entries()) {
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
