import { sql } from 'drizzle-orm';
import {
  check,
  integer,
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
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).defaultNow().notNull(),
    excluidoEm: timestamp('excluido_em', { withTimezone: true }),
  },
  (table) => [uniqueIndex('usuarios_discord_user_id_unique').on(table.discordUserId)],
);

export const commandConfigs = pgTable(
  'command_config',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    commandName: varchar('command_name', { length: 80 }).notNull().unique(),
    cooldownSeconds: integer('cooldown_seconds').notNull(),
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
    message: text('message').notNull(),
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
