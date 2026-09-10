import { readFile } from 'node:fs/promises';

import { Injectable } from '@nestjs/common';
import { Client } from 'minio';

const DEFAULT_KEY = 'defaults/card.webp';
const DEFAULT_CONTENT_TYPE = 'image/webp';

export type ImageFile = Readonly<{ buffer: Buffer; contentType: string; extension: string }>;

@Injectable()
export class CardImageStorage {
  async defaultImageUrl(): Promise<string> {
    await this.ensureDefault();
    return this.url(DEFAULT_KEY);
  }

  async upload(cardId: string, image: ImageFile): Promise<string> {
    await this.ensureDefault();
    return this.uploadAt(`cards/${cardId}/image.${image.extension}`, image);
  }

  async uploadPack(packId: string, image: ImageFile): Promise<string> {
    await this.ensureBucket();
    return this.uploadAt(`packs/${packId}/image.${image.extension}`, image);
  }

  private async uploadAt(key: string, image: ImageFile): Promise<string> {
    await this.client().putObject(this.bucket(), key, image.buffer, image.buffer.length, {
      'Content-Type': image.contentType,
    });
    return this.url(key);
  }

  async remove(url: string | null): Promise<void> {
    const key = this.keyFromUrl(url);
    if (key && key !== DEFAULT_KEY) await this.client().removeObject(this.bucket(), key);
  }

  private async ensureDefault(): Promise<void> {
    await this.ensureBucket();
    const client = this.client();
    const bucket = this.bucket();
    try {
      await client.statObject(bucket, DEFAULT_KEY);
    } catch {
      const image = await readFile(
        new URL('../../../media/assets/card/default.webp', import.meta.url),
      );
      await client.putObject(bucket, DEFAULT_KEY, image, image.length, {
        'Content-Type': DEFAULT_CONTENT_TYPE,
      });
    }
  }

  private async ensureBucket(): Promise<void> {
    const client = this.client();
    const bucket = this.bucket();
    if (!(await client.bucketExists(bucket))) await client.makeBucket(bucket);
    await client.setBucketPolicy(bucket, JSON.stringify(publicReadPolicy(bucket)));
  }

  private url(key: string): string {
    return `${this.publicUrl()}/${this.bucket()}/${key}`;
  }

  private keyFromUrl(url: string | null): string | null {
    if (!url) return null;
    const prefix = `${this.publicUrl()}/${this.bucket()}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }

  private bucket(): string {
    return required('MINIO_BUCKET');
  }

  private publicUrl(): string {
    return required('MINIO_PUBLIC_URL').replace(/\/$/, '');
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
