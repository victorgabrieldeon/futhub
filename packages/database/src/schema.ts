import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'usuarios',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    discordUserId: text('discord_user_id').notNull(),
    nome: varchar('nome', { length: 80 }).notNull(),
    urlAvatar: varchar('url_avatar', { length: 2048 }),
    saldo: integer('saldo').default(0).notNull(),
    xp: integer('xp').notNull().default(0),
    level: integer('level').notNull().default(1),
    language: varchar('language', { length: 35 }).notNull().default('pt-BR'),
    booster: boolean('booster').notNull().default(false),
    banned: boolean('banned').notNull().default(false),
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).defaultNow().notNull(),
    excluidoEm: timestamp('excluido_em', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('usuarios_discord_user_id_unique').on(table.discordUserId),
    check('usuarios_xp_nonnegative', sql`${table.xp} >= 0`),
    check('usuarios_level_positive', sql`${table.level} > 0`),
  ],
);

export const commandConfigs = pgTable(
  'command_config',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    commandName: varchar('command_name', { length: 80 }).notNull().unique(),
    cooldownSeconds: integer('cooldown_seconds').notNull(),
    embedTitle: varchar('embed_title', { length: 256 }).notNull().default('Lucro resgatado'),
    embedDescription: text('embed_description')
      .notNull()
      .default(
        '{message}\n\n**+{reward} moedas**\nSaldo: **{balance}**\nXP: **+{xp}** · Nível: **{level}**\nPróximo lucro: {availableAt}',
      ),
    embedColor: varchar('embed_color', { length: 7 }).notNull().default('#22c55e'),
    embedFooter: varchar('embed_footer', { length: 2048 }).notNull().default('FutHub'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check('command_config_cooldown_positive', sql`${table.cooldownSeconds} > 0`)],
);

export const commandRewards = pgTable(
  'command_reward',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    commandConfigId: uuid('command_config_id')
      .notNull()
      .references(() => commandConfigs.id, { onDelete: 'cascade' }),
    value: integer('value').notNull(),
    weight: integer('weight').notNull(),
    messageTextId: uuid('message_text_id')
      .notNull()
      .references(() => localizedTexts.id, { onDelete: 'restrict' }),
  },
  (table) => [
    check('command_reward_value_positive', sql`${table.value} > 0`),
    check('command_reward_weight_positive', sql`${table.weight} > 0`),
  ],
);

export const userCooldowns = pgTable(
  'user_cooldown',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    commandConfigId: uuid('command_config_id')
      .notNull()
      .references(() => commandConfigs.id, { onDelete: 'cascade' }),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.commandConfigId] })],
);

export const cardPosition = pgEnum('card_position', [
  'GOL',
  'LD',
  'LE',
  'ZAG',
  'VOL',
  'MA',
  'MC',
  'PD',
  'PE',
  'CA',
]);

export const cardClaimOrigin = pgEnum('card_claim_origin', [
  'pack',
  'redeem',
  'mission',
  'hire',
  'reward',
]);

export const rankedQueueStatus = pgEnum('ranked_queue_status', ['waiting', 'matched']);

export const matchEventType = pgEnum('match_event_type', [
  'kickoff',
  'goal',
  'yellow_card',
  'red_card',
  'fulltime',
]);

export const localizedTexts = pgTable('localized_texts', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const localizedTextTranslations = pgTable(
  'localized_text_translations',
  {
    localizedTextId: uuid('localized_text_id')
      .notNull()
      .references(() => localizedTexts.id, { onDelete: 'cascade' }),
    locale: varchar('locale', { length: 35 }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.localizedTextId, table.locale] })],
);

export const nationalities = pgTable('nationalities', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  emoji: varchar('emoji', { length: 30 }).notNull(),
  color: varchar('color', { length: 16 }).notNull(),
  imageUrl: varchar('image_url', { length: 2048 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  emoji: varchar('emoji', { length: 30 }).notNull(),
  color: varchar('color', { length: 16 }).notNull(),
  imageUrl: varchar('image_url', { length: 2048 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const collections = pgTable('collections', {
  id: uuid('id').defaultRandom().primaryKey(),
  nameTextId: uuid('name_text_id')
    .notNull()
    .references(() => localizedTexts.id, { onDelete: 'restrict' }),
  emoji: varchar('emoji', { length: 30 }).notNull(),
  primaryColor: varchar('primary_color', { length: 16 }).notNull(),
  secondaryColor: varchar('secondary_color', { length: 16 }).notNull(),
  imageUrl: varchar('image_url', { length: 2048 }),
  overlayUrl: varchar('overlay_url', { length: 2048 }),
  bannerUrl: varchar('banner_url', { length: 2048 }),
  contractsBlocked: boolean('contracts_blocked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const cardBackgrounds = pgTable('card_backgrounds', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  color: varchar('color', { length: 16 }).notNull(),
  imageUrl: varchar('image_url', { length: 2048 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const cardStats = pgTable(
  'card_stats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    passing: integer('passing').notNull(),
    control: integer('control').notNull(),
    marking: integer('marking').notNull(),
    pace: integer('pace').notNull(),
    dribbling: integer('dribbling').notNull(),
    finishing: integer('finishing').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'card_stats_positive',
      sql`${table.passing} > 0 and ${table.control} > 0 and ${table.marking} > 0 and ${table.pace} > 0 and ${table.dribbling} > 0 and ${table.finishing} > 0`,
    ),
  ],
);

export const cards = pgTable(
  'cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'restrict' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    nationalityId: uuid('nationality_id')
      .notNull()
      .references(() => nationalities.id, { onDelete: 'restrict' }),
    statsId: uuid('stats_id')
      .notNull()
      .unique()
      .references(() => cardStats.id, { onDelete: 'restrict' }),
    backgroundId: uuid('background_id').references(() => cardBackgrounds.id, {
      onDelete: 'set null',
    }),
    position: cardPosition('position').notNull(),
    contractsBlocked: boolean('contracts_blocked').notNull().default(false),
    defense: integer('defense').notNull(),
    attack: integer('attack').notNull(),
    creation: integer('creation').notNull(),
    overall: integer('overall').notNull(),
    imageUrl: varchar('image_url', { length: 2048 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('cards_overall_range', sql`${table.overall} between 60 and 100`),
    check(
      'cards_attributes_positive',
      sql`${table.defense} > 0 and ${table.attack} > 0 and ${table.creation} > 0`,
    ),
  ],
);

export const cardSecondaryPositions = pgTable(
  'card_secondary_positions',
  {
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    position: cardPosition('position').notNull(),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.position] })],
);

export const cardPriceConfigs = pgTable(
  'card_price_configs',
  {
    overall: integer('overall').primaryKey(),
    price: integer('price').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('card_price_configs_overall_range', sql`${table.overall} between 60 and 100`),
    check('card_price_configs_price_nonnegative', sql`${table.price} >= 0`),
  ],
);

export const cardMarketConfig = pgTable(
  'card_market_config',
  {
    singleton: boolean('singleton').notNull().default(true).unique(),
    sellMultiplierBasisPoints: integer('sell_multiplier_basis_points').notNull().default(2000),
    buyMultiplierBasisPoints: integer('buy_multiplier_basis_points').notNull().default(20000),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('card_market_config_singleton', sql`${table.singleton}`),
    check(
      'card_market_config_multipliers_nonnegative',
      sql`${table.sellMultiplierBasisPoints} >= 0 and ${table.buyMultiplierBasisPoints} >= 0`,
    ),
  ],
);

export const userCards = pgTable(
  'user_cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'restrict' }),
    goals: integer('goals').notNull().default(0),
    assists: integer('assists').notNull().default(0),
    matches: integer('matches').notNull().default(0),
    yellowCards: integer('yellow_cards').notNull().default(0),
    redCards: integer('red_cards').notNull().default(0),
    holder: boolean('holder').notNull().default(false),
    holderPosition: cardPosition('holder_position'),
    claimedBy: cardClaimOrigin('claimed_by').notNull().default('pack'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).defaultNow().notNull(),
    favorite: boolean('favorite').notNull().default(false),
    captain: boolean('captain').notNull().default(false),
  },
  (table) => [
    check(
      'user_cards_statistics_nonnegative',
      sql`${table.goals} >= 0 and ${table.assists} >= 0 and ${table.matches} >= 0 and ${table.yellowCards} >= 0 and ${table.redCards} >= 0`,
    ),
    check(
      'user_cards_holder_position',
      sql`(${table.holder} and ${table.holderPosition} is not null) or (not ${table.holder} and ${table.holderPosition} is null)`,
    ),
  ],
);

export const formations = pgTable('formations', {
  id: uuid('id').defaultRandom().primaryKey(),
  nameTextId: uuid('name_text_id')
    .notNull()
    .references(() => localizedTexts.id, { onDelete: 'restrict' }),
});

export const formationSlots = pgTable(
  'formation_slots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    formationId: uuid('formation_id')
      .notNull()
      .references(() => formations.id, { onDelete: 'cascade' }),
    position: cardPosition('position').notNull(),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
  },
  (table) => [
    uniqueIndex('formation_slots_coordinates_unique').on(table.formationId, table.x, table.y),
  ],
);

export const userFormations = pgTable('user_formations', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  formationId: uuid('formation_id')
    .notNull()
    .references(() => formations.id, { onDelete: 'restrict' }),
});

export const userLeagueStandings = pgTable(
  'user_league_standings',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    divisionId: uuid('division_id')
      .notNull()
      .references(() => divisions.id, { onDelete: 'restrict' }),
    points: integer('points').notNull().default(0),
    wins: integer('wins').notNull().default(0),
    draws: integer('draws').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'user_league_standings_nonnegative',
      sql`${table.points} >= 0 and ${table.wins} >= 0 and ${table.draws} >= 0 and ${table.losses} >= 0`,
    ),
  ],
);

export const soccerFields = pgTable('soccer_fields', {
  id: uuid('id').defaultRandom().primaryKey(),
  nameTextId: uuid('name_text_id')
    .notNull()
    .references(() => localizedTexts.id, { onDelete: 'restrict' }),
  color: varchar('color', { length: 16 }).notNull(),
  imageUrl: varchar('image_url', { length: 2048 }),
});

export const userSoccerFields = pgTable(
  'user_soccer_fields',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    soccerFieldId: uuid('soccer_field_id')
      .notNull()
      .references(() => soccerFields.id, { onDelete: 'restrict' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.soccerFieldId] })],
);

export const packProbabilities = pgTable(
  'pack_probabilities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull().default('default'),
    overall: integer('overall').notNull(),
    probability: integer('probability').notNull(),
  },
  (table) => [
    check('pack_probabilities_overall_range', sql`${table.overall} between 60 and 100`),
    check('pack_probabilities_positive', sql`${table.probability} > 0`),
  ],
);

export const packConfigs = pgTable(
  'pack_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }),
    minOverall: integer('min_overall').notNull().default(60),
    maxOverall: integer('max_overall').notNull().default(100),
  },
  (table) => [
    check(
      'pack_configs_overall_range',
      sql`${table.minOverall} between 60 and 100 and ${table.maxOverall} between 60 and 100 and ${table.minOverall} <= ${table.maxOverall}`,
    ),
  ],
);

export const packs = pgTable(
  'packs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    configId: uuid('config_id')
      .notNull()
      .unique()
      .references(() => packConfigs.id, { onDelete: 'cascade' }),
    imageUrl: varchar('image_url', { length: 2048 }),
    color: varchar('color', { length: 16 }).notNull(),
    emoji: varchar('emoji', { length: 255 }).notNull(),
    cardsAmount: integer('cards_amount').notNull().default(3),
    price: integer('price').notNull().default(15),
    canBuy: boolean('can_buy').notNull().default(true),
    limitPerUser: integer('limit_per_user').notNull().default(10),
  },
  (table) => [
    check(
      'packs_values_valid',
      sql`${table.cardsAmount} > 0 and ${table.price} >= 0 and ${table.limitPerUser} >= 0`,
    ),
  ],
);

export const packConfigOnlyPositions = pgTable(
  'pack_config_only_positions',
  {
    configId: uuid('config_id')
      .notNull()
      .references(() => packConfigs.id, { onDelete: 'cascade' }),
    position: cardPosition('position').notNull(),
  },
  (table) => [primaryKey({ columns: [table.configId, table.position] })],
);
export const packConfigExcludedPositions = pgTable(
  'pack_config_excluded_positions',
  {
    configId: uuid('config_id')
      .notNull()
      .references(() => packConfigs.id, { onDelete: 'cascade' }),
    position: cardPosition('position').notNull(),
  },
  (table) => [primaryKey({ columns: [table.configId, table.position] })],
);
export const packConfigOnlyCollections = pgTable(
  'pack_config_only_collections',
  {
    configId: uuid('config_id')
      .notNull()
      .references(() => packConfigs.id, { onDelete: 'cascade' }),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.configId, table.collectionId] })],
);
export const packConfigExcludedCollections = pgTable(
  'pack_config_excluded_collections',
  {
    configId: uuid('config_id')
      .notNull()
      .references(() => packConfigs.id, { onDelete: 'cascade' }),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.configId, table.collectionId] })],
);
export const packConfigOnlyCards = pgTable(
  'pack_config_only_cards',
  {
    configId: uuid('config_id')
      .notNull()
      .references(() => packConfigs.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.configId, table.cardId] })],
);
export const packConfigExcludedCards = pgTable(
  'pack_config_excluded_cards',
  {
    configId: uuid('config_id')
      .notNull()
      .references(() => packConfigs.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.configId, table.cardId] })],
);
export const packConfigOnlyTeams = pgTable(
  'pack_config_only_teams',
  {
    configId: uuid('config_id')
      .notNull()
      .references(() => packConfigs.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.configId, table.teamId] })],
);
export const packConfigExcludedTeams = pgTable(
  'pack_config_excluded_teams',
  {
    configId: uuid('config_id')
      .notNull()
      .references(() => packConfigs.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.configId, table.teamId] })],
);
export const packProbabilityLinks = pgTable(
  'pack_probability_links',
  {
    packId: uuid('pack_id')
      .notNull()
      .references(() => packs.id, { onDelete: 'cascade' }),
    probabilityId: uuid('probability_id')
      .notNull()
      .references(() => packProbabilities.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.packId, table.probabilityId] })],
);
export const userPacks = pgTable(
  'user_packs',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    packId: uuid('pack_id')
      .notNull()
      .references(() => packs.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.packId] }),
    check('user_packs_quantity_nonnegative', sql`${table.quantity} >= 0`),
  ],
);

export const itemType = pgEnum('item_type', ['card', 'pack', 'balance', 'field', 'premium']);
export const missionType = pgEnum('mission_type', [
  'open_pack',
  'sell_player',
  'claim_profit',
  'play_match',
]);
export const missionCadence = pgEnum('mission_cadence', ['daily', 'weekly', 'monthly']);
export const transactionType = pgEnum('transaction_type', [
  'purchase',
  'sale',
  'trade',
  'reward',
  'redeem',
]);

export const divisions = pgTable('divisions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayNameTextId: uuid('display_name_text_id').references(() => localizedTexts.id, {
    onDelete: 'restrict',
  }),
  emoji: varchar('emoji', { length: 50 }).notNull(),
  points: integer('points').notNull(),
  color: varchar('color', { length: 16 }),
  imageUrl: varchar('image_url', { length: 2048 }),
});
export const premiums = pgTable(
  'premiums',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    price: integer('price').notNull(),
    imageUrl: varchar('image_url', { length: 2048 }),
    durationDays: integer('duration_days').notNull(),
  },
  (table) => [
    check('premiums_values_valid', sql`${table.price} >= 0 and ${table.durationDays} > 0`),
  ],
);
export const premiumPacks = pgTable(
  'premium_packs',
  {
    premiumId: uuid('premium_id')
      .notNull()
      .references(() => premiums.id, { onDelete: 'cascade' }),
    packId: uuid('pack_id')
      .notNull()
      .references(() => packs.id, { onDelete: 'restrict' }),
  },
  (table) => [primaryKey({ columns: [table.premiumId, table.packId] })],
);
export const premiumSoccerFields = pgTable(
  'premium_soccer_fields',
  {
    premiumId: uuid('premium_id')
      .notNull()
      .references(() => premiums.id, { onDelete: 'cascade' }),
    soccerFieldId: uuid('soccer_field_id')
      .notNull()
      .references(() => soccerFields.id, { onDelete: 'restrict' }),
  },
  (table) => [primaryKey({ columns: [table.premiumId, table.soccerFieldId] })],
);
export const items = pgTable(
  'items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    displayNameTextId: uuid('display_name_text_id').references(() => localizedTexts.id, {
      onDelete: 'restrict',
    }),
    type: itemType('type').notNull(),
    amount: integer('amount').notNull().default(1),
    cardId: uuid('card_id').references(() => cards.id, { onDelete: 'restrict' }),
    packId: uuid('pack_id').references(() => packs.id, { onDelete: 'restrict' }),
    soccerFieldId: uuid('soccer_field_id').references(() => soccerFields.id, {
      onDelete: 'restrict',
    }),
    premiumId: uuid('premium_id').references(() => premiums.id, { onDelete: 'restrict' }),
  },
  (table) => [check('items_amount_positive', sql`${table.amount} > 0`)],
);
export const missions = pgTable(
  'missions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    titleTextId: uuid('title_text_id')
      .notNull()
      .references(() => localizedTexts.id, { onDelete: 'restrict' }),
    type: missionType('type').notNull(),
    cadence: missionCadence('cadence').notNull().default('daily'),
    tier: integer('tier').notNull().default(1),
    goal: integer('goal').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (table) => [
    check('missions_goal_positive', sql`${table.goal} > 0`),
    check('missions_tier_positive', sql`${table.tier} > 0`),
  ],
);
export const missionRewards = pgTable(
  'mission_rewards',
  {
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    tier: integer('tier').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.missionId, table.itemId, table.tier] }),
    check('mission_rewards_tier_positive', sql`${table.tier} > 0`),
  ],
);
export const userMissions = pgTable(
  'user_missions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    rewardItemId: uuid('reward_item_id').references(() => items.id, { onDelete: 'restrict' }),
    cadence: missionCadence('cadence').notNull(),
    periodKey: varchar('period_key', { length: 10 }).notNull(),
    tier: integer('tier').notNull(),
    progress: integer('progress').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('user_missions_user_mission_cadence_period_key_unique').on(
      table.userId,
      table.missionId,
      table.cadence,
      table.periodKey,
    ),
    check('user_missions_progress_nonnegative', sql`${table.progress} >= 0`),
    check('user_missions_tier_positive', sql`${table.tier} > 0`),
  ],
);
export const commandXpConfigs = pgTable(
  'command_xp_configs',
  { command: varchar('command', { length: 100 }).primaryKey(), xp: integer('xp').notNull() },
  (table) => [check('command_xp_configs_xp_nonnegative', sql`${table.xp} >= 0`)],
);
export const levelRewards = pgTable(
  'level_rewards',
  {
    level: integer('level').primaryKey(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
  },
  (table) => [check('level_rewards_level_positive', sql`${table.level} > 0`)],
);
export const trades = pgTable(
  'trades',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [check('trades_distinct_users', sql`${table.senderId} <> ${table.recipientId}`)],
);
export const tradeCards = pgTable(
  'trade_cards',
  {
    tradeId: uuid('trade_id')
      .notNull()
      .references(() => trades.id, { onDelete: 'cascade' }),
    userCardId: uuid('user_card_id')
      .notNull()
      .references(() => userCards.id, { onDelete: 'restrict' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.tradeId, table.userCardId] })],
);
export const transactionHistory = pgTable('transaction_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: transactionType('type').notNull(),
  amount: integer('amount').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
export const redeems = pgTable('redeems', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 100 }).notNull().unique(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => items.id, { onDelete: 'restrict' }),
  maxClaims: integer('max_claims'),
});
export const redeemClaims = pgTable(
  'redeem_claims',
  {
    redeemId: uuid('redeem_id')
      .notNull()
      .references(() => redeems.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.redeemId, table.userId] })],
);
export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    homeUserId: uuid('home_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    awayUserId: uuid('away_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seed: integer('seed').notNull().default(1),
    homeGoals: integer('home_goals').notNull().default(0),
    awayGoals: integer('away_goals').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('rooms_distinct_users', sql`${table.homeUserId} <> ${table.awayUserId}`),
    check('rooms_seed_positive', sql`${table.seed} > 0`),
    check('rooms_scores_nonnegative', sql`${table.homeGoals} >= 0 and ${table.awayGoals} >= 0`),
  ],
);

export const roomMatchEvents = pgTable(
  'room_match_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    minute: integer('minute').notNull(),
    type: matchEventType('type').notNull(),
    playerUserCardId: uuid('player_user_card_id').references(() => userCards.id, {
      onDelete: 'restrict',
    }),
    assistUserCardId: uuid('assist_user_card_id').references(() => userCards.id, {
      onDelete: 'restrict',
    }),
    description: text('description').notNull(),
    homeGoals: integer('home_goals').notNull(),
    awayGoals: integer('away_goals').notNull(),
  },
  (table) => [
    uniqueIndex('room_match_events_room_sequence_unique').on(table.roomId, table.sequence),
    check('room_match_events_sequence_positive', sql`${table.sequence} > 0`),
    check('room_match_events_minute_range', sql`${table.minute} between 0 and 90`),
    check(
      'room_match_events_scores_nonnegative',
      sql`${table.homeGoals} >= 0 and ${table.awayGoals} >= 0`,
    ),
  ],
);

export const rankedQueues = pgTable(
  'ranked_queue',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    divisionId: uuid('division_id')
      .notNull()
      .references(() => divisions.id, { onDelete: 'restrict' }),
    status: rankedQueueStatus('status').notNull(),
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    queuedAt: timestamp('queued_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'ranked_queue_status_room',
      sql`(${table.status} = 'waiting' and ${table.roomId} is null) or (${table.status} = 'matched' and ${table.roomId} is not null)`,
    ),
    uniqueIndex('ranked_queue_waiting_division_user_unique')
      .on(table.divisionId, table.userId)
      .where(sql`${table.status} = 'waiting'`),
  ],
);
export const profitConfigs = pgTable(
  'profit_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    probability: integer('probability').notNull(),
    amount: integer('amount').notNull(),
    descriptionTextId: uuid('description_text_id').references(() => localizedTexts.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    check('profit_configs_probability_positive', sql`${table.probability} > 0`),
    check('profit_configs_amount_positive', sql`${table.amount} > 0`),
  ],
);
export const genericCooldownConfigs = pgTable(
  'generic_cooldown_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resource: varchar('resource', { length: 100 }).notNull().unique(),
    availableUses: integer('available_uses').notNull().default(1),
    cooldownSeconds: integer('cooldown_seconds').notNull(),
  },
  (table) => [
    check(
      'generic_cooldown_configs_values_valid',
      sql`${table.availableUses} > 0 and ${table.cooldownSeconds} > 0`,
    ),
  ],
);
export const genericCooldowns = pgTable(
  'generic_cooldowns',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    configId: uuid('config_id')
      .notNull()
      .references(() => genericCooldownConfigs.id, { onDelete: 'cascade' }),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.configId] })],
);
export const topggConfigs = pgTable(
  'topgg_configs',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    reward: integer('reward').notNull().default(0),
  },
  (table) => [
    check('topgg_configs_singleton', sql`${table.singleton}`),
    check('topgg_configs_reward_nonnegative', sql`${table.reward} >= 0`),
  ],
);
export const topggHistory = pgTable(
  'topgg_history',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    votedOn: timestamp('voted_on', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.votedOn] })],
);

export const gameSettings = pgTable(
  'game_settings',
  {
    singleton: boolean('singleton').primaryKey().default(true),
    maxCardsPerUser: integer('max_cards_per_user').notNull().default(100),
  },
  (table) => [
    check('game_settings_singleton', sql`${table.singleton}`),
    check('game_settings_max_cards_positive', sql`${table.maxCardsPerUser} > 0`),
  ],
);
