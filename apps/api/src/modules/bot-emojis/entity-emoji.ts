type Database = typeof import('@futhub/database');
type Schema = Database['schema'];

/** Emoji exibido pelo bot: o da aplicação no Discord quando a imagem já virou emoji, senão o unicode. */
export function displayEmoji(
  sql: Database['sql'],
  table: Pick<Schema['teams'] | Schema['collections'] | Schema['packs'], 'emoji' | 'discordEmoji'>,
) {
  return sql<string>`coalesce(${table.discordEmoji}, ${table.emoji})`;
}
