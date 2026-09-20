import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { type E2eContext, adminToken, startE2eContext } from '../../test/e2e/context.js';
import { createCardCatalog } from '../../test/e2e/entities.js';
import { FilesService } from '../files/files.service.js';
import type { AiChatState } from './admin-ai.dto.js';
import { AiHttpClient } from './ai-http-client.js';
import type { AiMutation } from './ai-tools.js';

describe('Admin AI bulk card creation', () => {
  let context: E2eContext;
  let catalog: Awaited<ReturnType<typeof createCardCatalog>>;
  const headers = { authorization: `Bearer ${adminToken}` };

  beforeAll(async () => {
    context = await startE2eContext();
    catalog = await createCardCatalog(context.database, 'ai-bulk-cards');
  }, 120_000);
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => context?.close());

  it('proposes and persists ten cards from one assistant response', async () => {
    vi.spyOn(FilesService.prototype, 'defaultCardImage').mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      url: 'https://example.com/default.webp',
      contentType: 'image/webp',
      sizeBytes: 1,
      width: null,
      height: null,
    });
    const inputs: Extract<AiMutation, { name: 'create_card' }>['input'][] = Array.from(
      { length: 10 },
      (_, index) => ({
        ...catalog,
        slug: `ai-bulk-card-${index + 1}`,
        name: `Atleta em lote ${index + 1}`,
        position: 'CA',
        contractsBlocked: false,
        defense: 60,
        attack: 80,
        creation: 70,
        overall: 75,
        passing: 70,
        control: 75,
        marking: 55,
        pace: 80,
        dribbling: 75,
        finishing: 80,
        secondaryPositions: [],
      }),
    );
    const completion = (message: object, finishReason: 'tool_calls' | 'stop') => ({
      status: 200,
      body: {
        choices: [
          { index: 0, finish_reason: finishReason, message: { role: 'assistant', ...message } },
        ],
      },
    });
    vi.spyOn(AiHttpClient.prototype, 'request')
      .mockResolvedValueOnce({ status: 200, body: { data: [{ id: 'bulk-model' }] } })
      .mockResolvedValueOnce(
        completion(
          {
            content: 'Propostas prontas.',
            tool_calls: inputs.map((input, index) => ({
              id: `bulk-card-${index + 1}`,
              type: 'function',
              function: { name: 'create_card', arguments: JSON.stringify(input) },
            })),
          },
          'tool_calls',
        ),
      )
      .mockResolvedValueOnce(completion({ content: 'Dez cards criados.' }, 'stop'));

    const connected = await context.app.inject({
      method: 'POST',
      url: '/v1/admin/ai/sessions',
      headers,
      payload: {
        provider: 'openai',
        baseUrl: 'https://example.com/v1',
        apiKey: 'bulk-test-key',
      },
    });
    expect(connected.statusCode, connected.body).toBe(201);
    const url = `/v1/admin/ai/sessions/${connected.json<AiChatState>().id}`;
    const proposed = await context.app.inject({
      method: 'POST',
      url: `${url}/messages`,
      headers,
      payload: { model: 'bulk-model', message: 'Crie estes dez cards.' },
    });
    expect(proposed.statusCode, proposed.body).toBe(201);
    const actions = proposed.json<AiChatState>().actions;
    expect(actions).toHaveLength(10);
    expect(actions.every((action) => action.status === 'pending')).toBe(true);

    for (const action of actions) {
      const approved = await context.app.inject({
        method: 'POST',
        url: `${url}/actions/${action.id}`,
        headers,
        payload: { approved: true },
      });
      expect(approved.statusCode, approved.body).toBe(201);
    }

    const slugs = new Set(inputs.map(({ slug }) => slug));
    const persisted = (
      await context.database.db.select().from(context.database.schema.cards)
    ).filter(({ slug }) => slugs.has(slug));
    expect(persisted).toHaveLength(10);
  });
});
