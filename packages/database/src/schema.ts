import { integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('usuarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  nome: varchar('nome', { length: 80 }).notNull(),
  urlAvatar: varchar('url_avatar', { length: 2048 }),
  saldo: integer('saldo').default(0).notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).defaultNow().notNull(),
  excluidoEm: timestamp('excluido_em', { withTimezone: true }),
});
