import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type E2eContext,
  adminToken,
  internalToken,
  startE2eContext,
} from '../../test/e2e/context.js';
import type { AiChatState, AiSessionInput } from './admin-ai.dto.js';
import { AiHttpClient } from './ai-http-client.js';
import { AiSessions } from './ai-sessions.js';

describe('Admin AI saved configuration', () => {
  let context: E2eContext;
  const base = '/v1/admin/ai/sessions';
  const headers = { authorization: `Bearer ${adminToken}` };
  const connection = { provider: 'openai', baseUrl: 'https://example.com/v1' } as const;
  const apiKey = 'synthetic-config-key-never-use-in-production';
  const models = ['config-model-a', 'config-model-b'];

  beforeAll(async () => {
    context = await startE2eContext();
  }, 120_000);
  beforeEach(async () => {
    await context.database.db.delete(context.database.schema.adminAiConfigs);
    vi.spyOn(AiHttpClient.prototype, 'request').mockResolvedValue({
      status: 200,
      body: { data: models.map((id) => ({ id })), has_more: false },
    });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await context?.close();
  });

  async function connect(input: AiSessionInput = { ...connection, apiKey }) {
    const response = await context.app.inject({
      method: 'POST',
      url: base,
      headers,
      payload: input,
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<AiChatState>();
  }

  function stored() {
    return context.database.db.select().from(context.database.schema.adminAiConfigs);
  }

  async function selectModel(id: string, model: string) {
    vi.mocked(AiHttpClient.prototype.request).mockResolvedValueOnce({
      status: 200,
      body: {
        choices: [
          { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Resposta' } },
        ],
      },
    });
    const response = await context.app.inject({
      method: 'POST',
      url: `${base}/${id}/messages`,
      headers,
      payload: { model, message: 'Teste de configuração' },
    });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json()).toMatchObject({ model });
  }

  it.each([
    { name: 'missing', headers: {} },
    { name: 'invalid', headers: { authorization: 'Bearer invalid-admin-token' } },
    { name: 'internal-only', headers: { authorization: `Bearer ${internalToken}` } },
  ])('rejects config reads and writes when admin credentials are $name', async (credentials) => {
    // Given: saved credentials accessible only to the admin.
    await connect();
    const before = await stored();
    vi.mocked(AiHttpClient.prototype.request).mockClear();
    // When: unauthenticated callers read metadata or try to replace the key.
    const read = await context.app.inject({
      method: 'GET',
      url: `${base}/config`,
      headers: credentials.headers,
    });
    const write = await context.app.inject({
      method: 'POST',
      url: base,
      headers: credentials.headers,
      payload: { ...connection, apiKey: 'synthetic-replacement-key' },
    });
    // Then: neither disclosure nor persisted changes nor provider calls occur.
    expect(read.statusCode).toBe(401);
    expect(write.statusCode).toBe(401);
    expect(read.body).not.toContain(apiKey);
    expect(await stored()).toEqual(before);
    expect(AiHttpClient.prototype.request).not.toHaveBeenCalled();
  });

  it('returns null metadata when no config has been saved', async () => {
    // Given: the isolated database has no saved config.
    // When: an admin reads config metadata.
    const response = await context.app.inject({ method: 'GET', url: `${base}/config`, headers });
    // Then: empty metadata is not a fabricated connection.
    expect(response.statusCode).toBe(200);
    expect(response.json()).toBeNull();
    expect(await stored()).toEqual([]);
  });

  it('upgrades an OpenCode Go URL submitted through the legacy OpenAI-compatible option', async () => {
    // Given: an existing browser submits OpenCode Go through the old generic provider value.
    const legacy = {
      provider: 'openai',
      baseUrl: 'https://opencode.ai/zen/go/v1',
      apiKey,
    } as const;

    // When: the configuration is saved through HTTP.
    const response = await context.app.inject({
      method: 'PUT',
      url: `${base}/config`,
      headers,
      payload: legacy,
    });

    // Then: OpenCode Go protocol is explicit in browser metadata and persisted state.
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      provider: 'opencode-go',
      baseUrl: legacy.baseUrl,
      apiKeyConfigured: true,
      models,
      model: null,
    });
    expect(await stored()).toMatchObject([{ provider: 'opencode-go', baseUrl: legacy.baseUrl }]);
  });

  it('configures the provider separately and starts a session without connection data', async () => {
    // Given: an admin saves provider credentials through the configuration endpoint.
    const configured = await context.app.inject({
      method: 'PUT',
      url: `${base}/config`,
      headers,
      payload: { ...connection, apiKey },
    });
    expect(configured.statusCode, configured.body).toBe(200);
    expect(configured.json()).toEqual({
      ...connection,
      apiKeyConfigured: true,
      models,
      model: null,
    });
    vi.mocked(AiHttpClient.prototype.request).mockClear();

    // When: the assistant starts from the saved configuration only.
    const response = await context.app.inject({ method: 'POST', url: `${base}/saved`, headers });

    // Then: session uses persisted models and no credential returns to browser or provider discovery.
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json()).toMatchObject({ models, model: null });
    expect(response.body).not.toContain(apiKey);
    expect(AiHttpClient.prototype.request).not.toHaveBeenCalled();
    const rows = await stored();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(apiKey);
  });

  it('rejects an omitted key when no saved config exists', async () => {
    // Given: no previous credentials.
    // When: connecting without a key.
    const response = await context.app.inject({
      method: 'POST',
      url: base,
      headers,
      payload: connection,
    });
    // Then: no config or upstream request is created.
    expect(response.statusCode).toBe(400);
    expect(await stored()).toEqual([]);
    expect(AiHttpClient.prototype.request).not.toHaveBeenCalled();
  });

  it('reuses the saved Anthropic key after disconnect and loss of in-memory credentials', async () => {
    const provider = 'anthropic';
    // Given: credentials saved by HTTP, then removed from the active session store.
    const state = await connect({ ...connection, provider, apiKey });
    const disconnected = await context.app.inject({
      method: 'DELETE',
      url: `${base}/${state.id}`,
      headers,
    });
    expect(disconnected.statusCode).toBe(204);
    context.app.get(AiSessions).onModuleDestroy();
    vi.mocked(AiHttpClient.prototype.request).mockClear();
    // When: a new session omits the key for the same provider and base URL.
    const reconnected = await connect({ ...connection, provider });
    // Then: discovery receives the decrypted key using the provider's actual auth header.
    expect(reconnected.id).not.toBe(state.id);
    expect(reconnected.models).toEqual(models);
    expect(AiHttpClient.prototype.request).toHaveBeenCalledExactlyOnceWith(
      new URL(`${connection.baseUrl}/models`),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'x-api-key': apiKey }),
      }),
    );
    const rows = await stored();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ...connection, provider, models });
    expect(JSON.stringify(rows)).not.toContain(apiKey);
  });

  it.each([
    { provider: 'anthropic', baseUrl: connection.baseUrl },
    { provider: 'openai', baseUrl: 'https://other.example.com/v1' },
  ] as const)('rejects a changed connection without a key: $provider $baseUrl', async (input) => {
    // Given: a saved key bound to the original provider and URL.
    await connect();
    const before = await stored();
    vi.mocked(AiHttpClient.prototype.request).mockClear();
    // When: attempting to reuse it for another destination.
    const response = await context.app.inject({
      method: 'POST',
      url: base,
      headers,
      payload: input,
    });
    // Then: HTTP rejects the change before sending credentials or updating storage.
    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(apiKey);
    expect(await stored()).toEqual(before);
    expect(AiHttpClient.prototype.request).not.toHaveBeenCalled();
  });

  it('preserves saved credentials when discovery rejects a replacement key', async () => {
    // Given: a working saved connection and a replacement rejected by the upstream.
    await connect();
    const before = await stored();
    const replacement = 'synthetic-rejected-key';
    vi.mocked(AiHttpClient.prototype.request).mockResolvedValueOnce({
      status: 401,
      body: { error: { message: replacement } },
    });
    // When: attempting to save the replacement through HTTP.
    const response = await context.app.inject({
      method: 'POST',
      url: base,
      headers,
      payload: { ...connection, apiKey: replacement },
    });
    // Then: failure is sanitized and the previous encrypted config remains usable.
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain(replacement);
    expect(response.body).not.toContain(apiKey);
    expect(await stored()).toEqual(before);
    await connect(connection);
    expect(AiHttpClient.prototype.request).toHaveBeenLastCalledWith(
      new URL(`${connection.baseUrl}/models`),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${apiKey}` }),
      }),
    );
  });

  it('keeps the last selected model across new sessions and omitted-key reconnects', async () => {
    // Given: successive HTTP conversations select different models.
    const first = await connect();
    await selectModel(first.id, 'config-model-a');
    const second = await connect(connection);
    await selectModel(second.id, 'config-model-b');
    context.app.get(AiSessions).onModuleDestroy();
    // When: reconnecting without credentials and reading saved metadata.
    await connect(connection);
    const response = await context.app.inject({ method: 'GET', url: `${base}/config`, headers });
    // Then: reconnect does not reset or restore the older selection.
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      ...connection,
      apiKeyConfigured: true,
      models,
      model: 'config-model-b',
    });
    const rows = await stored();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.model).toBe('config-model-b');
  });
});
