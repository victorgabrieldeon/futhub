import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const adminAiHistory = pgTable(
  'admin_ai_history',
  {
    id: uuid('id').primaryKey(),
    owner: varchar('owner', { length: 64 }).notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    provider: varchar('provider', { length: 20 }).notNull(),
    model: text('model'),
    state: jsonb('state').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('admin_ai_history_owner_updated').on(table.owner, table.updatedAt, table.id)],
);

export const adminAiConfigs = pgTable('admin_ai_configs', {
  owner: varchar('owner', { length: 64 }).primaryKey(),
  provider: varchar('provider', { length: 20 }).notNull(),
  baseUrl: varchar('base_url', { length: 2048 }).notNull(),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  models: jsonb('models').$type<string[]>().notNull(),
  model: text('model'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
