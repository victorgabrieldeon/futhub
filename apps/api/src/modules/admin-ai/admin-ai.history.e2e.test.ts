import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { type E2eContext, adminToken, startE2eContext } from '../../test/e2e/context.js';
import { AiHttpClient } from './ai-http-client.js';
import { AiSessions } from './ai-sessions.js';

describe('Admin AI durable history', () => {
  let context: E2eContext;
  const headers = { authorization: `Bearer ${adminToken}` };
  const base = '/v1/admin/ai/sessions';
  beforeAll(async () => {
    context = await startE2eContext();
  }, 120_000);
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await context?.close();
  });

  it('requires admin authentication for history and capabilities', async () => {
    for (const path of ['history', 'capabilities']) {
      const response = await context.app.inject({ method: 'GET', url: `${base}/${path}` });
      expect(response.statusCode).toBe(401);
    }
  });

  it('rejects invalid pages and returns an empty page past stored history', async () => {
    for (const page of ['0', '-1', '1.5', '10001', 'bad']) {
      const response = await context.app.inject({
        method: 'GET',
        url: `${base}/history?page=${page}`,
        headers,
      });
      expect(response.statusCode).toBe(400);
    }
    const response = await context.app.inject({
      method: 'GET',
      url: `${base}/history?page=10000`,
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ items: [], page: 10000, pageSize: 20 });
    const { db, sql } = context.database;
    const count = await db.execute(sql`select count(*)::int as total from admin_ai_history`);
    expect(response.json<{ total: number }>().total).toBe(count.rows[0]?.total);
  });

  it('keeps messages after disconnect and loss of in-memory credentials', async () => {
    // Given: a real HTTP conversation with only the external provider faked.
    const wire = vi.spyOn(AiHttpClient.prototype, 'request');
    wire.mockResolvedValueOnce({ status: 200, body: { data: [{ id: 'history-model' }] } });
    const connected = await context.app.inject({
      method: 'POST',
      url: base,
      headers,
      payload: {
        provider: 'openai',
        baseUrl: 'https://example.com/v1',
        apiKey: 'history-secret-key',
      },
    });
    expect(connected.statusCode).toBe(201);
    const { id } = connected.json<{ id: string }>();
    wire.mockResolvedValueOnce({
      status: 200,
      body: {
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: 'Resposta preservada' },
          },
        ],
      },
    });
    const message = await context.app.inject({
      method: 'POST',
      url: `${base}/${id}/messages`,
      headers,
      payload: { model: 'history-model', message: 'Histórico de teste' },
    });
    expect(message.statusCode, message.body).toBe(201);

    // When: the active session is disconnected and process-local sessions disappear.
    const disconnected = await context.app.inject({
      method: 'DELETE',
      url: `${base}/${id}`,
      headers,
    });
    expect(disconnected.statusCode).toBe(204);
    context.app.get(AiSessions).onModuleDestroy();

    // Then: HTTP history and persisted JSON retain the transcript, never the connection secret.
    const archived = await context.app.inject({
      method: 'GET',
      url: `${base}/history/${id}`,
      headers,
    });
    expect(archived.statusCode, archived.body).toBe(200);
    expect(archived.json()).toMatchObject({
      id,
      model: 'history-model',
      title: 'Histórico de teste',
      state: {
        messages: [
          { role: 'user', content: 'Histórico de teste' },
          { role: 'assistant', content: 'Resposta preservada' },
        ],
      },
    });
    const { db, sql } = context.database;
    const persisted = await db.execute(sql`select * from admin_ai_history where id = ${id}`);
    expect(persisted.rows).toHaveLength(1);
    expect(JSON.stringify(persisted.rows)).not.toContain('history-secret-key');
    expect(JSON.stringify(persisted.rows)).not.toContain('baseUrl');
    const live = await context.app.inject({ method: 'GET', url: `${base}/${id}`, headers });
    expect(live.statusCode).toBe(404);
    const listing = await context.app.inject({
      method: 'GET',
      url: `${base}/history?page=1`,
      headers,
    });
    expect(listing.statusCode, listing.body).toBe(200);
    expect(listing.json()).toMatchObject({
      page: 1,
      pageSize: 20,
      items: expect.arrayContaining([expect.objectContaining({ id, title: 'Histórico de teste' })]),
    });
  });

  it('never returns another owner history', async () => {
    // Given: an HTTP-created session reassigned to another owner in persistent storage.
    vi.spyOn(AiHttpClient.prototype, 'request').mockResolvedValue({
      status: 200,
      body: { data: [] },
    });
    const created = await context.app.inject({
      method: 'POST',
      url: base,
      headers,
      payload: { provider: 'openai', baseUrl: 'https://example.com/v1', apiKey: 'owner-test' },
    });
    const { id } = created.json<{ id: string }>();
    const { db, eq, schema } = context.database;
    await db
      .update(schema.adminAiHistory)
      .set({ owner: 'another-owner' })
      .where(eq(schema.adminAiHistory.id, id));
    // When: trying to read/list that record under the authenticated owner.
    const detail = await context.app.inject({
      method: 'GET',
      url: `${base}/history/${id}`,
      headers,
    });
    const listing = await context.app.inject({ method: 'GET', url: `${base}/history`, headers });
    // Then: no cross-owner disclosure.
    expect(detail.statusCode).toBe(404);
    expect(listing.statusCode).toBe(200);
    expect(listing.json<{ items: { id: string }[] }>().items.some((item) => item.id === id)).toBe(
      false,
    );
  });
});
