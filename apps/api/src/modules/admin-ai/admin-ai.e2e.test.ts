import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { type E2eContext, adminToken, startE2eContext } from '../../test/e2e/context.js';
import type { AiChatState } from './admin-ai.dto.js';
import { AiHttpClient } from './ai-http-client.js';

const completed = {
  status: 200,
  body: {
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'OK' } }],
  },
};

function teamProposal(slug: string, extra: object = {}) {
  return {
    status: 200,
    body: {
      choices: [
        {
          index: 0,
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: 'Proposta',
            tool_calls: [
              {
                id: 'team-call',
                type: 'function',
                function: {
                  name: 'create_team',
                  arguments: JSON.stringify({
                    slug,
                    name: slug,
                    emoji: 'FC',
                    color: '#123456',
                    ...extra,
                  }),
                },
              },
            ],
          },
        },
      ],
    },
  };
}

describe('Admin AI tools HTTP boundary', () => {
  let context: E2eContext;
  const headers = { authorization: `Bearer ${adminToken}` };
  const connection = {
    provider: 'openai',
    baseUrl: 'https://example.com/v1',
    apiKey: 'test-provider-key',
  };
  beforeAll(async () => {
    context = await startE2eContext();
  }, 120_000);
  afterAll(async () => {
    vi.restoreAllMocks();
    await context?.close();
  });
  afterEach(() => vi.restoreAllMocks());

  it('rejects unauthenticated connections', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/v1/admin/ai/sessions',
      payload: connection,
    });
    expect(response.statusCode).toBe(401);
  });

  it('persists encrypted provider config and reconnects with saved settings over HTTP', async () => {
    const wire = vi.spyOn(AiHttpClient.prototype, 'request');
    wire
      .mockResolvedValueOnce({
        status: 200,
        body: { data: [{ id: 'saved-model' }, { id: 'other-model' }] },
      })
      .mockResolvedValueOnce(completed);
    const connected = await context.app.inject({
      method: 'POST',
      url: '/v1/admin/ai/sessions',
      headers,
      payload: connection,
    });
    expect(connected.statusCode, connected.body).toBe(201);
    const session = connected.json<AiChatState>();
    const messaged = await context.app.inject({
      method: 'POST',
      url: `/v1/admin/ai/sessions/${session.id}/messages`,
      headers,
      payload: { model: 'saved-model', message: 'Olá' },
    });
    expect(messaged.statusCode, messaged.body).toBe(201);
    const config = await context.app.inject({
      method: 'GET',
      url: '/v1/admin/ai/sessions/config',
      headers,
    });
    expect(config.statusCode, config.body).toBe(200);
    expect(config.json()).toEqual({
      provider: connection.provider,
      baseUrl: connection.baseUrl,
      apiKeyConfigured: true,
      models: ['other-model', 'saved-model'],
      model: 'saved-model',
    });
    expect(config.body).not.toContain(connection.apiKey);
    const { db, schema } = context.database;
    const [stored] = await db.select().from(schema.adminAiConfigs);
    expect(stored?.encryptedApiKey).not.toContain(connection.apiKey);
    expect(stored?.models).toEqual(['other-model', 'saved-model']);
    wire.mockResolvedValueOnce({ status: 200, body: { data: [{ id: 'saved-model' }] } });
    const reconnected = await context.app.inject({
      method: 'POST',
      url: '/v1/admin/ai/sessions',
      headers,
      payload: { provider: connection.provider, baseUrl: connection.baseUrl },
    });
    expect(reconnected.statusCode, reconnected.body).toBe(201);
    expect(reconnected.json<AiChatState>().models).toEqual(['saved-model']);
    expect(reconnected.body).not.toContain(connection.apiKey);
  });

  it('creates a team only after approval and never repeats an approved action', async () => {
    const wire = vi.spyOn(AiHttpClient.prototype, 'request');
    wire.mockResolvedValueOnce({ status: 200, body: { data: [{ id: 'test-model' }] } });
    const connected = await context.app.inject({
      method: 'POST',
      url: '/v1/admin/ai/sessions',
      headers,
      payload: connection,
    });
    expect(connected.statusCode, connected.body).toBe(201);
    const session = connected.json<{ id: string }>();
    const url = `/v1/admin/ai/sessions/${session.id}`;
    wire.mockResolvedValueOnce({
      status: 200,
      body: {
        choices: [
          {
            index: 0,
            finish_reason: 'tool_calls',
            message: {
              role: 'assistant',
              content: 'Proposta',
              tool_calls: [
                {
                  id: 'call-team',
                  type: 'function',
                  function: {
                    name: 'create_team',
                    arguments: JSON.stringify({
                      slug: 'ai-test-team',
                      name: 'AI Test Team',
                      emoji: 'FC',
                      color: '#123456',
                    }),
                  },
                },
              ],
            },
          },
        ],
      },
    });
    const proposed = await context.app.inject({
      method: 'POST',
      url: `${url}/messages`,
      headers,
      payload: { model: 'test-model', message: 'Crie um time' },
    });
    expect(proposed.statusCode, proposed.body).toBe(201);
    const state = proposed.json<{ actions: { id: string; status: string }[] }>();
    const action = state.actions[0];
    expect(action?.status, proposed.body).toBe('pending');
    const { db, schema, eq } = context.database;
    expect(
      await db.select().from(schema.teams).where(eq(schema.teams.slug, 'ai-test-team')),
    ).toHaveLength(0);
    wire.mockResolvedValueOnce({
      status: 200,
      body: {
        choices: [
          { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Concluído' } },
        ],
      },
    });
    const actionUrl = `${url}/actions/${action?.id}`;
    const approved = await context.app.inject({
      method: 'POST',
      url: actionUrl,
      headers,
      payload: { approved: true },
    });
    expect(approved.statusCode, approved.body).toBe(201);
    expect(approved.json<{ actions: { status: string }[] }>().actions[0]?.status).toBe('succeeded');
    await context.app.inject({
      method: 'POST',
      url: actionUrl,
      headers,
      payload: { approved: true },
    });
    expect(
      await db.select().from(schema.teams).where(eq(schema.teams.slug, 'ai-test-team')),
    ).toHaveLength(1);
    expect(approved.body).not.toContain(connection.apiKey);
    wire.mockRestore();
  });

  it.each(['reject', 'adjust', 'invalid', 'provider-failure'] as const)(
    'keeps persisted team state correct when %s happens',
    async (scenario) => {
      const slug = `ai-${scenario}`;
      const wire = vi
        .spyOn(AiHttpClient.prototype, 'request')
        .mockResolvedValueOnce({ status: 404, body: {} });
      const connected = await context.app.inject({
        method: 'POST',
        url: '/v1/admin/ai/sessions',
        headers,
        payload: connection,
      });
      expect(connected.statusCode, connected.body).toBe(201);
      const session = connected.json<AiChatState>();
      expect(session.models).toEqual([]);
      const url = `/v1/admin/ai/sessions/${session.id}`;
      wire
        .mockResolvedValueOnce(
          teamProposal(
            slug,
            scenario === 'invalid' ? { imageUrl: 'https://example.com/x.png' } : {},
          ),
        )
        .mockResolvedValue(completed);
      const proposed = await context.app.inject({
        method: 'POST',
        url: `${url}/messages`,
        headers,
        payload: { model: 'manual-model', message: 'Crie time' },
      });
      const action = proposed.json<AiChatState>().actions[0];
      if (scenario === 'invalid') {
        expect(action).toBeUndefined();
      } else {
        expect(action?.status, proposed.body).toBe('pending');
        if (!action) throw new Error('Expected proposal');
        const actionUrl = `${url}/actions/${action.id}`;
        if (scenario === 'adjust') {
          await context.app.inject({
            method: 'POST',
            url: `${url}/messages`,
            headers,
            payload: { model: 'manual-model', message: 'Cancele proposta anterior' },
          });
        }
        if (scenario === 'provider-failure')
          wire.mockRejectedValueOnce(new Error(connection.apiKey));
        const decided = await context.app.inject({
          method: 'POST',
          url: actionUrl,
          headers,
          payload: { approved: scenario !== 'reject' },
        });
        expect(decided.statusCode, decided.body).toBe(201);
        expect(decided.json<AiChatState>().actions[0]?.status).toBe(
          scenario === 'provider-failure' ? 'succeeded' : 'rejected',
        );
        expect(decided.body).not.toContain(connection.apiKey);
        const repeated = await context.app.inject({
          method: 'POST',
          url: actionUrl,
          headers,
          payload: { approved: true },
        });
        expect(repeated.json<AiChatState>().actions[0]?.status).toBe(
          scenario === 'provider-failure' ? 'succeeded' : 'rejected',
        );
      }
      const { db, schema, eq } = context.database;
      expect(await db.select().from(schema.teams).where(eq(schema.teams.slug, slug))).toHaveLength(
        scenario === 'provider-failure' ? 1 : 0,
      );
      const deleted = await context.app.inject({ method: 'DELETE', url, headers });
      expect(deleted.statusCode).toBe(204);
      expect(deleted.body).toBe('');
      expect((await context.app.inject({ method: 'GET', url, headers })).statusCode).toBe(404);
    },
  );

  it('does not echo invalid provider credentials in validation errors', async () => {
    const apiKey = 'invalid-secret-'.repeat(400);
    const response = await context.app.inject({
      method: 'POST',
      url: '/v1/admin/ai/sessions',
      headers,
      payload: { ...connection, apiKey },
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(apiKey);
  });
});
