import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { FilesService } from '../files/files.service.js';
import type { PackShopDto, PackShopItemDto } from './packs.dto.js';

@Injectable()
export class PackShopService {
  constructor(@Inject(FilesService) private readonly files: FilesService) {}

  async list(page: number): Promise<PackShopDto> {
    const { db, eq, sql, schema } = await import('@futhub/database');
    const { packs } = schema;
    // canBuy is the only catalog availability flag, matching purchase validation.
    const [count] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(packs)
      .where(eq(packs.canBuy, true));
    const rows = await db
      .select()
      .from(packs)
      .where(eq(packs.canBuy, true))
      .orderBy(packs.name, packs.id)
      .limit(5)
      .offset((page - 1) * 5);
    return {
      packs: await this.items(rows),
      page,
      totalPages: Math.max(1, Math.ceil((count?.total ?? 0) / 5)),
    };
  }

  async inspect(id: string): Promise<PackShopItemDto> {
    const { db, and, eq, schema } = await import('@futhub/database');
    const rows = await db
      .select()
      .from(schema.packs)
      .where(and(eq(schema.packs.id, id), eq(schema.packs.canBuy, true)));
    const [item] = await this.items(rows);
    if (!item) throw new NotFoundException('Pack not found.');
    return item;
  }

  private async items(
    rows: {
      id: string;
      name: string;
      price: number;
      imageFileId: string | null;
      imageUrl: string | null;
      cardsAmount: number;
    }[],
  ): Promise<PackShopItemDto[]> {
    const urls = await this.files.urls(
      rows.flatMap((row) => (row.imageFileId ? [row.imageFileId] : [])),
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      price: row.price,
      imageUrl: row.imageFileId ? (urls.get(row.imageFileId) ?? '') : (row.imageUrl ?? ''),
      cardsPerPack: row.cardsAmount,
    }));
  }
}
