import { and, db, desc, eq, schema, sql } from '@futhub/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import typia from 'typia';
import type { AiHistoryDetail, AiHistoryPage } from './admin-ai.dto.js';
import type { AiSession } from './ai-sessions.js';

@Injectable()
export class AiHistoryService {
  async save(session: AiSession): Promise<void> {
    // Store only the public transcript, never provider credentials or executable commands.
    const value = {
      id: session.state.id,
      owner: session.owner,
      title:
        session.state.messages.find((message) => message.role === 'user')?.content.slice(0, 120) ??
        'Nova conversa',
      provider: session.connection.provider,
      model: session.model,
      state: session.state,
      updatedAt: new Date(),
    };
    await db
      .insert(schema.adminAiHistory)
      .values(value)
      .onConflictDoUpdate({
        target: schema.adminAiHistory.id,
        set: {
          title: value.title,
          model: value.model,
          state: value.state,
          updatedAt: value.updatedAt,
        },
        setWhere: eq(schema.adminAiHistory.owner, session.owner),
      });
  }

  async list(owner: string, page = 1): Promise<AiHistoryPage> {
    const table = schema.adminAiHistory;
    const filter = eq(table.owner, owner);
    const [items, counts] = await Promise.all([
      db
        .select({
          id: table.id,
          title: table.title,
          provider: table.provider,
          model: table.model,
          createdAt: table.createdAt,
          updatedAt: table.updatedAt,
        })
        .from(table)
        .where(filter)
        .orderBy(desc(table.updatedAt), desc(table.id))
        .limit(20)
        .offset((page - 1) * 20),
      db.select({ total: sql<number>`count(*)::int` }).from(table).where(filter),
    ]);
    return typia.assert<AiHistoryPage>({
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      total: counts[0]?.total ?? 0,
      page,
      pageSize: 20,
    });
  }

  async get(owner: string, id: string): Promise<AiHistoryDetail> {
    if (!typia.is<string & typia.tags.Format<'uuid'>>(id))
      throw new NotFoundException('Conversa não encontrada.');
    const table = schema.adminAiHistory;
    const [row] = await db
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.owner, owner)));
    if (!row) throw new NotFoundException('Conversa não encontrada.');
    return typia.assert<AiHistoryDetail>({
      id: row.id,
      title: row.title,
      provider: row.provider,
      model: row.model,
      state: row.state,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }
}
