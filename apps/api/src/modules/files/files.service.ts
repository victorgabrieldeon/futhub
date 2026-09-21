import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';

import { BadRequestException, Injectable } from '@nestjs/common';
import { Client } from 'minio';
import { workspacePath } from '../../workspace-path.js';

const defaultCardObjectKey = 'defaults/card.webp';
const maxImageBytes = 10 * 1024 * 1024;
const importHosts = new Set([
  'assets.footylogos.com',
  'game-assets.fut.gg',
  'r2.fut.gg',
  'r2.thesportsdb.com',
]);
const extensionsByContentType = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
} as const;

type Database = typeof import('@futhub/database');
export type FileSource = 'upload' | 'import' | 'seed' | 'generated';
export type ImageContentType = keyof typeof extensionsByContentType;
export type ImageFile = Readonly<{
  buffer: Buffer;
  contentType: ImageContentType;
  extension: (typeof extensionsByContentType)[ImageContentType];
  originalName?: string;
}>;
export type FileDto = Readonly<{
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}>;

export function imageFile(buffer: Buffer, contentType: string): ImageFile {
  switch (contentType) {
    case 'image/jpeg':
      return { buffer, contentType, extension: 'jpg' };
    case 'image/png':
      return { buffer, contentType, extension: 'png' };
    case 'image/webp':
      return { buffer, contentType, extension: 'webp' };
    default:
      throw new BadRequestException('Use JPEG, PNG, or WebP image.');
  }
}

@Injectable()
export class FilesService {
  async upload(image: ImageFile): Promise<FileDto> {
    return this.store(image, { source: 'upload', prefix: 'uploads' });
  }

  async generated(image: ImageFile): Promise<FileDto> {
    return this.store(image, { source: 'generated', prefix: 'generated' });
  }

  async importImage(sourceUrl: string, contentType?: ImageContentType): Promise<FileDto> {
    const url = this.importUrl(sourceUrl);
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new BadRequestException('Could not download image source.');
    const resolvedContentType = this.contentType(response.headers.get('content-type'), contentType);
    const image: ImageFile = {
      buffer: await this.responseBuffer(response),
      contentType: resolvedContentType,
      extension: extensionsByContentType[resolvedContentType],
      originalName: url.pathname.split('/').pop(),
    };
    return this.store(image, { source: 'import', sourceUrl, prefix: 'imports' });
  }

  async backfillLegacyImage(sourceUrl: string): Promise<FileDto> {
    const objectKey = this.objectKeyFromUrl(sourceUrl);
    if (!objectKey) return this.importImage(sourceUrl);
    const stat = await this.client().statObject(this.bucket(), objectKey);
    const contentType = this.contentType(
      typeof stat.metaData?.['content-type'] === 'string' ? stat.metaData['content-type'] : null,
      undefined,
    );
    const database = await this.database();
    await database.db
      .insert(database.schema.files)
      .values({
        objectKey,
        contentType,
        sizeBytes: stat.size,
        originalName: objectKey.split('/').pop() ?? null,
        source: 'upload',
        metadata: {},
      })
      .onConflictDoNothing({ target: database.schema.files.objectKey });
    const file = await database.db.query.files.findFirst({
      where: database.eq(database.schema.files.objectKey, objectKey),
    });
    if (!file) throw new Error('Failed to backfill file.');
    return this.dto(file);
  }

  async defaultCardImage(): Promise<FileDto> {
    await this.ensureBucket();
    const client = this.client();
    const bucket = this.bucket();
    let sizeBytes: number;
    try {
      sizeBytes = (await client.statObject(bucket, defaultCardObjectKey)).size;
    } catch {
      const buffer = await readFile(workspacePath('apps/api/media/assets/card/default.webp'));
      await client.putObject(bucket, defaultCardObjectKey, buffer, buffer.length, {
        'Content-Type': 'image/webp',
      });
      sizeBytes = buffer.length;
    }
    const database = await this.database();
    await database.db
      .insert(database.schema.files)
      .values({
        objectKey: defaultCardObjectKey,
        contentType: 'image/webp',
        sizeBytes,
        originalName: 'default.webp',
        source: 'seed',
        metadata: {},
      })
      .onConflictDoNothing({ target: database.schema.files.objectKey });
    const file = await database.db.query.files.findFirst({
      where: database.eq(database.schema.files.objectKey, defaultCardObjectKey),
    });
    if (!file) throw new Error('Failed to load default card file.');
    return this.dto(file);
  }

  async urls(fileIds: readonly string[]): Promise<Map<string, string>> {
    const ids = [...new Set(fileIds)];
    if (!ids.length) return new Map();
    const database = await this.database();
    const rows = await database.db
      .select({ id: database.schema.files.id, objectKey: database.schema.files.objectKey })
      .from(database.schema.files)
      .where(database.inArray(database.schema.files.id, ids));
    return new Map(rows.map((file) => [file.id, fileUrl(file.objectKey)]));
  }

  async removeIfUnused(fileId: string | null): Promise<void> {
    if (!fileId) return;
    const database = await this.database();
    const { db, eq, schema } = database;
    const [file] = await db
      .select({ objectKey: schema.files.objectKey })
      .from(schema.files)
      .where(eq(schema.files.id, fileId));
    if (!file) return;
    const references = await Promise.all([
      db
        .select({ id: schema.cards.id })
        .from(schema.cards)
        .where(eq(schema.cards.imageFileId, fileId))
        .limit(1),
      db
        .select({ id: schema.cardBackgrounds.id })
        .from(schema.cardBackgrounds)
        .where(eq(schema.cardBackgrounds.imageFileId, fileId))
        .limit(1),
      db
        .select({ id: schema.collections.id })
        .from(schema.collections)
        .where(eq(schema.collections.imageFileId, fileId))
        .limit(1),
      db
        .select({ id: schema.collections.id })
        .from(schema.collections)
        .where(eq(schema.collections.overlayFileId, fileId))
        .limit(1),
      db
        .select({ id: schema.collections.id })
        .from(schema.collections)
        .where(eq(schema.collections.bannerFileId, fileId))
        .limit(1),
      db
        .select({ id: schema.divisions.id })
        .from(schema.divisions)
        .where(eq(schema.divisions.imageFileId, fileId))
        .limit(1),
      db
        .select({ id: schema.packs.id })
        .from(schema.packs)
        .where(eq(schema.packs.imageFileId, fileId))
        .limit(1),
      db
        .select({ id: schema.premiums.id })
        .from(schema.premiums)
        .where(eq(schema.premiums.imageFileId, fileId))
        .limit(1),
      db
        .select({ id: schema.soccerFields.id })
        .from(schema.soccerFields)
        .where(eq(schema.soccerFields.imageFileId, fileId))
        .limit(1),
      db
        .select({ id: schema.teams.id })
        .from(schema.teams)
        .where(eq(schema.teams.logoFileId, fileId))
        .limit(1),
    ]);
    if (references.some((rows) => rows.length)) return;
    await db.delete(schema.files).where(eq(schema.files.id, fileId));
    await this.client().removeObject(this.bucket(), file.objectKey);
  }

  private async store(
    image: ImageFile,
    input: Readonly<{ source: FileSource; prefix: string; sourceUrl?: string }>,
  ): Promise<FileDto> {
    if (!image.buffer.length || image.buffer.length > maxImageBytes)
      throw new BadRequestException('Image must contain at most 10 MB.');
    const objectKey = `${input.prefix}/${randomUUID()}.${image.extension}`;
    await this.ensureBucket();
    await this.client().putObject(this.bucket(), objectKey, image.buffer, image.buffer.length, {
      'Content-Type': image.contentType,
    });
    const database = await this.database();
    try {
      const [file] = await database.db
        .insert(database.schema.files)
        .values({
          objectKey,
          contentType: image.contentType,
          sizeBytes: image.buffer.length,
          originalName: image.originalName?.slice(0, 255) ?? null,
          sha256: createHash('sha256').update(image.buffer).digest('hex'),
          source: input.source,
          sourceUrl: input.sourceUrl ?? null,
          metadata: {},
        })
        .returning();
      if (!file) throw new Error('Failed to create file.');
      return this.dto(file);
    } catch (error) {
      await this.client().removeObject(this.bucket(), objectKey);
      throw error;
    }
  }

  private dto(file: {
    id: string;
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
  }): FileDto {
    return {
      id: file.id,
      url: fileUrl(file.objectKey),
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      width: file.width,
      height: file.height,
    };
  }

  private importUrl(value: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('Image source must be a valid URL.');
    }
    if (url.protocol !== 'https:' || !importHosts.has(url.hostname))
      throw new BadRequestException('Image source host is not allowed.');
    return url;
  }

  private contentType(
    value: string | null,
    expected: ImageContentType | undefined,
  ): ImageContentType {
    const contentType = value?.split(';')[0]?.trim().toLowerCase();
    if (expected && contentType !== expected)
      throw new BadRequestException('Image source content type is invalid.');
    switch (contentType) {
      case 'image/jpeg':
      case 'image/png':
      case 'image/svg+xml':
      case 'image/webp':
        return contentType;
      default:
        throw new BadRequestException('Image source must be JPEG, PNG, SVG, or WebP.');
    }
  }

  private async responseBuffer(response: Response): Promise<Buffer> {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maxImageBytes)
      throw new BadRequestException('Image must contain at most 10 MB.');
    if (!response.body) throw new BadRequestException('Image source has no body.');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of Readable.fromWeb(response.body)) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > maxImageBytes) throw new BadRequestException('Image must contain at most 10 MB.');
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }

  private async ensureBucket(): Promise<void> {
    const client = this.client();
    const bucket = this.bucket();
    if (!(await client.bucketExists(bucket))) await client.makeBucket(bucket);
    await client.setBucketPolicy(bucket, JSON.stringify(publicReadPolicy(bucket)));
  }

  private bucket(): string {
    return required('MINIO_BUCKET');
  }

  private objectKeyFromUrl(value: string): string | null {
    const prefix = `${required('MINIO_PUBLIC_URL').replace(/\/$/, '')}/${this.bucket()}/`;
    return value.startsWith(prefix) ? value.slice(prefix.length) : null;
  }

  private client(): Client {
    return new Client({
      endPoint: required('MINIO_ENDPOINT'),
      port: Number(required('MINIO_PORT')),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: required('MINIO_ACCESS_KEY'),
      secretKey: required('MINIO_SECRET_KEY'),
    });
  }

  private database(): Promise<Database> {
    return import('@futhub/database');
  }
}

export function fileUrl(objectKey: string): string {
  return `${required('MINIO_PUBLIC_URL').replace(/\/$/, '')}/${required('MINIO_BUCKET')}/${objectKey}`;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function publicReadPolicy(bucket: string): object {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  };
}
