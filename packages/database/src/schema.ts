import { integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('usuarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  nome: varchar('nome', { length: 80 }).notNull(),
  urlAvatar: varchar('url_avatar', { length: 2048 }),
  saldo: integer('saldo').default(0).notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).defaultNow().notNull(),
  excluidoEm: timestamp('excluido_em', { withTimezone: true }),
});

export const cardBases = pgTable('card_bases', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 80 }).notNull(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  width: varchar('width', { length: 10 }).notNull(),
  height: varchar('height', { length: 10 }).notNull(),
  design: jsonb('design').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
