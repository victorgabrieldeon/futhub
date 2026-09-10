import { FilesService } from '../modules/files/files.service.js';

type Database = typeof import('@futhub/database');
type LegacyRow = Readonly<{ id: string; sourceUrl: string }>;
type LegacyReference = Readonly<{
  name: string;
  list(): Promise<LegacyRow[]>;
  assign(id: string, fileId: string): Promise<void>;
}>;

const database = await import('@futhub/database');
const files = new FilesService();

await Promise.all(mappings(database).map(backfill));

async function backfill(reference: LegacyReference): Promise<void> {
  const rows = await reference.list();
  for (const row of rows) {
    const file = await files.backfillLegacyImage(row.sourceUrl);
    await reference.assign(row.id, file.id);
  }
  process.stdout.write(`${reference.name}: ${rows.length} migrated\n`);
}

function mappings(database: Database): LegacyReference[] {
  const { db, eq, schema, sql } = database;
  return [
    reference(
      'cards',
      () =>
        db
          .select({ id: schema.cards.id, sourceUrl: schema.cards.imageUrl })
          .from(schema.cards)
          .where(sql`${schema.cards.imageFileId} is null and ${schema.cards.imageUrl} is not null`),
      (id, fileId) =>
        db.update(schema.cards).set({ imageFileId: fileId }).where(eq(schema.cards.id, id)),
    ),
    reference(
      'card backgrounds',
      () =>
        db
          .select({ id: schema.cardBackgrounds.id, sourceUrl: schema.cardBackgrounds.imageUrl })
          .from(schema.cardBackgrounds)
          .where(
            sql`${schema.cardBackgrounds.imageFileId} is null and ${schema.cardBackgrounds.imageUrl} is not null`,
          ),
      (id, fileId) =>
        db
          .update(schema.cardBackgrounds)
          .set({ imageFileId: fileId })
          .where(eq(schema.cardBackgrounds.id, id)),
    ),
    reference(
      'collection images',
      () =>
        db
          .select({ id: schema.collections.id, sourceUrl: schema.collections.imageUrl })
          .from(schema.collections)
          .where(
            sql`${schema.collections.imageFileId} is null and ${schema.collections.imageUrl} is not null`,
          ),
      (id, fileId) =>
        db
          .update(schema.collections)
          .set({ imageFileId: fileId })
          .where(eq(schema.collections.id, id)),
    ),
    reference(
      'collection overlays',
      () =>
        db
          .select({ id: schema.collections.id, sourceUrl: schema.collections.overlayUrl })
          .from(schema.collections)
          .where(
            sql`${schema.collections.overlayFileId} is null and ${schema.collections.overlayUrl} is not null`,
          ),
      (id, fileId) =>
        db
          .update(schema.collections)
          .set({ overlayFileId: fileId })
          .where(eq(schema.collections.id, id)),
    ),
    reference(
      'collection banners',
      () =>
        db
          .select({ id: schema.collections.id, sourceUrl: schema.collections.bannerUrl })
          .from(schema.collections)
          .where(
            sql`${schema.collections.bannerFileId} is null and ${schema.collections.bannerUrl} is not null`,
          ),
      (id, fileId) =>
        db
          .update(schema.collections)
          .set({ bannerFileId: fileId })
          .where(eq(schema.collections.id, id)),
    ),
    reference(
      'divisions',
      () =>
        db
          .select({ id: schema.divisions.id, sourceUrl: schema.divisions.imageUrl })
          .from(schema.divisions)
          .where(
            sql`${schema.divisions.imageFileId} is null and ${schema.divisions.imageUrl} is not null`,
          ),
      (id, fileId) =>
        db.update(schema.divisions).set({ imageFileId: fileId }).where(eq(schema.divisions.id, id)),
    ),
    reference(
      'packs',
      () =>
        db
          .select({ id: schema.packs.id, sourceUrl: schema.packs.imageUrl })
          .from(schema.packs)
          .where(sql`${schema.packs.imageFileId} is null and ${schema.packs.imageUrl} is not null`),
      (id, fileId) =>
        db.update(schema.packs).set({ imageFileId: fileId }).where(eq(schema.packs.id, id)),
    ),
    reference(
      'premiums',
      () =>
        db
          .select({ id: schema.premiums.id, sourceUrl: schema.premiums.imageUrl })
          .from(schema.premiums)
          .where(
            sql`${schema.premiums.imageFileId} is null and ${schema.premiums.imageUrl} is not null`,
          ),
      (id, fileId) =>
        db.update(schema.premiums).set({ imageFileId: fileId }).where(eq(schema.premiums.id, id)),
    ),
    reference(
      'soccer fields',
      () =>
        db
          .select({ id: schema.soccerFields.id, sourceUrl: schema.soccerFields.imageUrl })
          .from(schema.soccerFields)
          .where(
            sql`${schema.soccerFields.imageFileId} is null and ${schema.soccerFields.imageUrl} is not null`,
          ),
      (id, fileId) =>
        db
          .update(schema.soccerFields)
          .set({ imageFileId: fileId })
          .where(eq(schema.soccerFields.id, id)),
    ),
    reference(
      'teams',
      () =>
        db
          .select({ id: schema.teams.id, sourceUrl: schema.teams.imageUrl })
          .from(schema.teams)
          .where(sql`${schema.teams.logoFileId} is null and ${schema.teams.imageUrl} is not null`),
      (id, fileId) =>
        db.update(schema.teams).set({ logoFileId: fileId }).where(eq(schema.teams.id, id)),
    ),
  ];
}

function reference(
  name: string,
  list: () => Promise<ReadonlyArray<Readonly<{ id: string; sourceUrl: string | null }>>>,
  assign: (id: string, fileId: string) => Promise<unknown>,
): LegacyReference {
  return {
    name,
    list: async () =>
      (await list()).flatMap((row) =>
        row.sourceUrl ? [{ ...row, sourceUrl: row.sourceUrl }] : [],
      ),
    assign: async (id, fileId) => {
      await assign(id, fileId);
    },
  };
}
