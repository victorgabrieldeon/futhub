import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';

import { FilesService } from '../files/files.service.js';
import type { BotEmojiDto } from './bot-emojis.dto.js';
import { BotEmojiLimitException, BotEmojisService } from './bot-emojis.service.js';

type Database = typeof import('@futhub/database');
type Schema = Database['schema'];
export type EmojiEntity = 'team' | 'collection' | 'pack';
type EntityRow = {
  id: string;
  label: string;
  fileId: string | null;
  discordEmoji: string | null;
  discordEmojiFileId: string | null;
};

// Discord exibe emojis em até 128x128.
const size = 128;
// Chave fixa do pg_try_advisory_lock: só uma réplica da API roda o retroativo por vez.
const backfillLockKey = 7_302_114;
const entities = ['team', 'collection', 'pack'] as const satisfies readonly EmojiEntity[];

function columns(schema: Schema, entity: EmojiEntity) {
  if (entity === 'team')
    return {
      prefix: 'tm',
      table: schema.teams,
      id: schema.teams.id,
      label: schema.teams.slug,
      fileId: schema.teams.logoFileId,
      discordEmoji: schema.teams.discordEmoji,
      discordEmojiFileId: schema.teams.discordEmojiFileId,
    };
  if (entity === 'collection')
    return {
      prefix: 'col',
      table: schema.collections,
      id: schema.collections.id,
      label: schema.collections.slug,
      fileId: schema.collections.imageFileId,
      discordEmoji: schema.collections.discordEmoji,
      discordEmojiFileId: schema.collections.discordEmojiFileId,
    };
  return {
    prefix: 'pk',
    table: schema.packs,
    id: schema.packs.id,
    label: schema.packs.name,
    fileId: schema.packs.imageFileId,
    discordEmoji: schema.packs.discordEmoji,
    discordEmojiFileId: schema.packs.discordEmojiFileId,
  };
}

/**
 * Nome do emoji no Discord: prefixo do tipo, slug (ou nome do pack) e o início do ID do
 * arquivo. Trocar a imagem muda o nome, então o emoji novo sobe antes de o antigo sair.
 */
export function entityEmojiName(prefix: string, label: string, fileId: string): string {
  const base = label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20)
    .replace(/_+$/, '');
  const suffix = fileId.replace(/-/g, '').slice(0, 6);
  return [prefix, base, suffix].filter(Boolean).join('_');
}

function mention(emoji: Pick<BotEmojiDto, 'id' | 'name' | 'animated'>): string {
  return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
}

function mentionId(value: string | null): string | undefined {
  return value ? /^<a?:[A-Za-z0-9_]{2,32}:(\d{17,20})>$/.exec(value)?.[1] : undefined;
}

/**
 * Mantém um emoji da aplicação no Discord para cada time, coleção e pack com imagem. O
 * vínculo fica em `discord_emoji`, e as leituras do bot preferem ele ao emoji unicode.
 */
@Injectable()
export class EntityEmojisService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EntityEmojisService.name);

  constructor(
    @Inject(BotEmojisService) private readonly emojis: BotEmojisService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test' || !this.emojis.isConfigured()) return;
    // Não segura a subida da API: o retroativo pode levar minutos por causa do rate limit.
    void this.backfillOnce().catch((error) =>
      this.logger.error('Falha no retroativo de emojis de times, coleções e packs.', error),
    );
  }

  /**
   * Cria, troca ou remove o emoji conforme a imagem atual. Nunca lança: o cadastro já foi
   * salvo, e o retroativo da próxima subida corrige o que falhar aqui.
   */
  async sync(entity: EmojiEntity, id: string): Promise<void> {
    if (!this.emojis.isConfigured()) return;
    try {
      const database = await this.database();
      const table = columns(database.schema, entity);
      const [row] = await this.rows(database, entity, database.eq(table.id, id));
      if (row) await this.apply(database, entity, row);
    } catch (error) {
      this.logger.warn(`Não foi possível sincronizar o emoji de ${entity} ${id}: ${error}`);
    }
  }

  /** Apaga o emoji de um cadastro removido. */
  async remove(discordEmoji: string | null): Promise<void> {
    const id = mentionId(discordEmoji);
    if (!id || !this.emojis.isConfigured()) return;
    await this.deleteEmoji(id);
  }

  /** Sincroniza todos os cadastros com imagem cujo emoji falta, está velho ou sumiu do Discord. */
  async backfill(): Promise<{ synced: number; failed: number }> {
    const database = await this.database();
    const pending = await Promise.all(
      entities.map(async (entity) => {
        const table = columns(database.schema, entity);
        const where = database.sql<boolean>`(${table.fileId} IS NOT NULL OR ${table.discordEmoji} IS NOT NULL)`;
        return { entity, rows: await this.rows(database, entity, where) };
      }),
    );
    if (pending.every(({ rows }) => !rows.length)) return { synced: 0, failed: 0 };
    const { emojis } = await this.emojis.list();
    const ids = new Set(emojis.map((emoji) => emoji.id));
    const byName = new Map(emojis.map((emoji) => [emoji.name, emoji]));
    let synced = 0;
    let failed = 0;
    for (const { entity, rows } of pending) {
      for (const row of rows) {
        const linkedId = mentionId(row.discordEmoji);
        const stale = row.fileId
          ? row.fileId !== row.discordEmojiFileId || !linkedId || !ids.has(linkedId)
          : row.discordEmoji !== null;
        if (!stale) continue;
        try {
          await this.apply(database, entity, row, byName);
          synced += 1;
        } catch (error) {
          if (error instanceof BotEmojiLimitException) {
            this.logger.warn(`Retroativo interrompido: ${error.message}`);
            return { synced, failed: failed + 1 };
          }
          failed += 1;
          this.logger.warn(`Não foi possível sincronizar o emoji de ${entity} ${row.id}: ${error}`);
        }
      }
    }
    return { synced, failed };
  }

  private async backfillOnce(): Promise<void> {
    const database = await this.database();
    const client = await database.pool.connect();
    try {
      const { rows } = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [backfillLockKey],
      );
      if (!rows[0]?.locked) return;
      try {
        const { synced, failed } = await this.backfill();
        if (synced || failed)
          this.logger.log(
            `Emojis de times, coleções e packs: ${synced} sincronizados, ${failed} com falha.`,
          );
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [backfillLockKey]);
      }
    } finally {
      client.release();
    }
  }

  private async rows(
    database: Database,
    entity: EmojiEntity,
    where: ReturnType<Database['sql']> | ReturnType<Database['eq']>,
  ): Promise<EntityRow[]> {
    const table = columns(database.schema, entity);
    return database.db
      .select({
        id: table.id,
        label: table.label,
        fileId: table.fileId,
        discordEmoji: table.discordEmoji,
        discordEmojiFileId: table.discordEmojiFileId,
      })
      .from(table.table)
      .where(where);
  }

  private async apply(
    database: Database,
    entity: EmojiEntity,
    row: EntityRow,
    byName?: ReadonlyMap<string, BotEmojiDto>,
  ): Promise<void> {
    const table = columns(database.schema, entity);
    const linkedId = mentionId(row.discordEmoji);
    let emoji: BotEmojiDto | undefined;
    if (row.fileId) {
      const name = entityEmojiName(table.prefix, row.label, row.fileId);
      emoji = byName?.get(name) ?? (await this.upload(name, row.fileId));
    }
    await database.db
      .update(table.table)
      .set({
        discordEmoji: emoji ? mention(emoji) : null,
        discordEmojiFileId: emoji ? row.fileId : null,
      })
      .where(database.eq(table.id, row.id));
    if (linkedId && linkedId !== emoji?.id) await this.deleteEmoji(linkedId);
  }

  private async upload(name: string, fileId: string): Promise<BotEmojiDto> {
    const image = await this.render(fileId);
    try {
      return await this.emojis.upload(name, image);
    } catch (error) {
      // Uma tentativa anterior pode ter subido o emoji sem chegar a gravar o vínculo.
      const existing = (await this.emojis.list()).emojis.find((emoji) => emoji.name === name);
      if (existing) return existing;
      throw error;
    }
  }

  private async render(fileId: string): Promise<string> {
    const image = await loadImage(await this.files.read(fileId));
    const canvas = createCanvas(size, size);
    // Encaixa sem distorcer; SVGs sem tamanho intrínseco ocupam o quadro inteiro.
    const scale = image.width && image.height ? size / Math.max(image.width, image.height) : 0;
    const width = scale ? image.width * scale : size;
    const height = scale ? image.height * scale : size;
    canvas
      .getContext('2d')
      .drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    return `data:image/png;base64,${(await canvas.encode('png')).toString('base64')}`;
  }

  private async deleteEmoji(id: string): Promise<void> {
    try {
      await this.emojis.remove(id);
    } catch (error) {
      if (!(error instanceof NotFoundException))
        this.logger.warn(`Não foi possível apagar o emoji ${id} do Discord: ${error}`);
    }
  }

  private database(): Promise<Database> {
    return import('@futhub/database');
  }
}
