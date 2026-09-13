import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { type E2eContext, adminToken, startE2eContext } from '../../test/e2e/context.js';
import type { AiChatState } from './admin-ai.dto.js';
import { AiHttpClient } from './ai-http-client.js';

function chunk(delta: object, finish_reason: string | null = null): Uint8Array {
  return Buffer.from(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason }] })}\n\n`,
  );
}
const end = Buffer.from('data: [DONE]\n\n');
const toolCall = (name: string, args: object) => ({
  tool_calls: [
    {
      index: 0,
      id: `call-${name}`,
      type: 'function',
      function: { name, arguments: JSON.stringify(args) },
    },
  ],
});

describe('Admin AI streaming HTTP', () => {
  let context: E2eContext;
  let origin: string;
  const base = '/v1/admin/ai/sessions';
  const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
  beforeAll(async () => {
    context = await startE2eContext();
    await context.app.listen(0, '127.0.0.1');
    origin = await context.app.getUrl();
  }, 60_000);
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  afterAll(async () => {
    await context?.close();
  });

  async function connect(): Promise<string> {
    vi.spyOn(AiHttpClient.prototype, 'request').mockResolvedValue({
      status: 200,
      body: { data: [{ id: 'stream-model' }] },
    });
    const response = await context.app.inject({
      method: 'POST',
      url: base,
      headers,
      payload: { provider: 'openai', baseUrl: 'https://example.com/v1', apiKey: 'stream-secret' },
    });
    expect(response.statusCode, response.body).toBe(201);
    return `${base}/${response.json<{ id: string }>().id}`;
  }

  function send(path: string, payload: object, authenticated = true): Promise<Response> {
    return fetch(`${origin}${path}`, {
      method: 'POST',
      headers: authenticated ? headers : { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  }

  it('delivers text before completion, locks concurrent requests and persists final text', async () => {
    // Given: provider sends one delta, then waits for the client to observe it.
    const url = await connect();
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let finished = false;
    vi.spyOn(AiHttpClient.prototype, 'requestStream').mockImplementation(async (_url, options) => {
      expect(JSON.parse(options.body ?? '{}')).toMatchObject({ stream: true });
      options.onResponse?.(200, { 'content-type': 'text/event-stream' });
      options.onChunk(chunk({ role: 'assistant', content: 'Bom dia' }));
      await held;
      options.onChunk(chunk({ content: ', vamos conversar.' }));
      options.onChunk(chunk({}, 'stop'));
      options.onChunk(end);
      finished = true;
      return { status: 200, body: null };
    });
    let text = '';
    try {
      // When: real HTTP client reads the still-open response.
      const response = await send(`${url}/messages/stream`, {
        model: 'stream-model',
        message: 'Olá',
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      expect(response.headers.get('cache-control')).toContain('no-store');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Missing response stream');
      while (!text.includes('Bom dia')) {
        const next = await reader.read();
        expect(next.done).toBe(false);
        text += Buffer.from(next.value ?? []).toString('utf8');
      }
      // Then: partial output precedes provider completion; concurrent writes are refused.
      expect(finished).toBe(false);
      const busy = await send(`${url}/messages/stream`, {
        model: 'stream-model',
        message: 'Duplicada',
      });
      expect(busy.status).toBe(409);
      release();
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        text += Buffer.from(next.value).toString('utf8');
      }
    } finally {
      release();
    }
    expect(text).toContain('"type":"text"');
    expect(text).toContain('"type":"done"');
    const archived = await context.app.inject({
      method: 'GET',
      url: `${base}/history/${url.split('/').at(-1)}`,
      headers,
    });
    expect(archived.json<{ state: AiChatState }>().state.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'Olá' }),
      expect.objectContaining({ role: 'assistant', content: 'Bom dia, vamos conversar.' }),
    ]);
    const unauthenticated = await send(
      `${url}/messages/stream`,
      { model: 'stream-model', message: 'Não' },
      false,
    );
    expect(unauthenticated.status).toBe(401);
  });

  it('searches web, proposes a write, and persists exactly one approved creation', async () => {
    // Given: web sources and provider wire are fake; HTTP/catalog/persistence are real.
    const url = await connect();
    vi.mocked(AiHttpClient.prototype.request).mockResolvedValue({
      status: 200,
      body: '<div data-type="web"><a href="https://gremio.net/elenco"><div class="search-snippet-title">Clube oficial</div></a><div class="generic-snippet"><div class="content">Elenco da temporada</div></div></div>',
    });
    const wire = vi.spyOn(AiHttpClient.prototype, 'requestStream');
    wire
      .mockImplementationOnce(async (_url, options) => {
        options.onResponse?.(200, { 'content-type': 'text/event-stream' });
        options.onChunk(chunk({ role: 'assistant' }));
        options.onChunk(
          chunk(
            toolCall('web_search', { query: 'Grêmio elenco 2026 site:gremio.net' }),
            'tool_calls',
          ),
        );
        options.onChunk(end);
        return { status: 200, body: null };
      })
      .mockImplementationOnce(async (_url, options) => {
        options.onResponse?.(200, { 'content-type': 'text/event-stream' });
        options.onChunk(chunk({ role: 'assistant' }));
        expect(options.body).toContain('https://gremio.net/elenco');
        options.onChunk(
          chunk(
            toolCall('create_team', {
              name: 'Streaming Club',
              slug: 'streaming-club',
              emoji: 'SC',
              color: '#123456',
            }),
            'tool_calls',
          ),
        );
        options.onChunk(end);
        return { status: 200, body: null };
      });
    const response = await send(`${url}/messages/stream`, {
      model: 'stream-model',
      message: 'Pesquise e proponha time',
    });
    expect(await response.text()).toContain('"type":"done"');
    const proposed = await context.app.inject({ method: 'GET', url, headers });
    const action = proposed.json<AiChatState>().actions[0];
    expect(action?.status, proposed.body).toBe('pending');
    const { db, schema, eq } = context.database;
    expect(
      await db.select().from(schema.teams).where(eq(schema.teams.slug, 'streaming-club')),
    ).toHaveLength(0);
    wire.mockImplementation(async (_url, options) => {
      options.onResponse?.(200, { 'content-type': 'text/event-stream' });
      options.onChunk(chunk({ role: 'assistant', content: 'Time criado.' }, 'stop'));
      options.onChunk(end);
      return { status: 200, body: null };
    });
    // When: explicit approval is sent, then replayed after its response.
    const approveUrl = `${url}/actions/${action?.id}/stream`;
    expect(await (await send(approveUrl, { approved: true })).text()).toContain('Time criado.');
    expect(await (await send(approveUrl, { approved: true })).text()).toContain('"type":"done"');
    // Then: one row and one terminal approval remain in durable history.
    expect(
      await db.select().from(schema.teams).where(eq(schema.teams.slug, 'streaming-club')),
    ).toHaveLength(1);
    expect(wire).toHaveBeenCalledTimes(3);
    const archived = await context.app.inject({
      method: 'GET',
      url: `${base}/history/${url.split('/').at(-1)}`,
      headers,
    });
    expect(archived.json<{ state: AiChatState }>().state.actions[0]?.status).toBe('succeeded');
  });

  it('does not execute or archive an incomplete tool call', async () => {
    // Given: an interrupted provider response containing text and a partial tool call.
    const url = await connect();
    vi.spyOn(AiHttpClient.prototype, 'requestStream').mockImplementation(async (_url, options) => {
      options.onResponse?.(200, { 'content-type': 'text/event-stream' });
      options.onChunk(chunk({ role: 'assistant', content: 'Preparando proposta' }));
      options.onChunk(chunk(toolCall('create_team', { name: 'Incomplete' })));
      return { status: 200, body: null };
    });
    const response = await send(`${url}/messages/stream`, {
      model: 'stream-model',
      message: 'Crie time',
    });
    expect(await response.text()).toContain('Preparando proposta');
    // Then: reconciliation keeps the accepted user message, no executable action.
    const state = (await context.app.inject({ method: 'GET', url, headers })).json<AiChatState>();
    expect(state.actions).toEqual([]);
    expect(state.notice).toBeTruthy();
    expect(state.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'Crie time' }),
    ]);
  });
});
