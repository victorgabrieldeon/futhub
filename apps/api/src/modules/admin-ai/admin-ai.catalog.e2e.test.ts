import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { type E2eContext, adminToken, startE2eContext } from '../../test/e2e/context.js';
import { createCardCatalog } from '../../test/e2e/entities.js';
import { FilesService } from '../files/files.service.js';
import type { AiChatState } from './admin-ai.dto.js';
import { AiHttpClient } from './ai-http-client.js';
import type { AiMutation } from './ai-tools.js';

describe('Admin AI confirmed catalog creations', () => {
  let context: E2eContext;
  let catalog: Awaited<ReturnType<typeof createCardCatalog>>;
  const headers = { authorization: `Bearer ${adminToken}` };
  beforeAll(async () => {
    context = await startE2eContext();
    catalog = await createCardCatalog(context.database, 'ai-catalog');
  }, 60_000);
  afterAll(() => context?.close());
  afterEach(() => vi.restoreAllMocks());

  async function counts() {
    const { db, schema } = context.database;
    return Promise.all(
      [
        schema.collections,
        schema.localizedTexts,
        schema.localizedTextTranslations,
        schema.cards,
        schema.cardStats,
        schema.cardSecondaryPositions,
        schema.packs,
        schema.packConfigs,
        schema.packConfigOnlyCollections,
        schema.packConfigOnlyTeams,
        schema.packConfigOnlyPositions,
      ].map(async (table) => (await db.select().from(table)).length),
    );
  }

  async function propose(command: AiMutation) {
    const before = await counts();
    const completion = (message: object, finish_reason: 'tool_calls' | 'stop') => ({
      status: 200,
      body: { choices: [{ finish_reason, message: { role: 'assistant', ...message } }] },
    });
    vi.spyOn(AiHttpClient.prototype, 'request')
      .mockResolvedValueOnce({ status: 200, body: { data: [{ id: 'catalog-model' }] } })
      .mockResolvedValueOnce(
        completion(
          {
            content: null,
            tool_calls: [
              {
                id: 'catalog-call',
                type: 'function',
                function: { name: command.name, arguments: JSON.stringify(command.input) },
              },
            ],
          },
          'tool_calls',
        ),
      )
      .mockResolvedValueOnce(completion({ content: 'Concluído' }, 'stop'));
    const connected = await context.app.inject({
      method: 'POST',
      url: '/v1/admin/ai/sessions',
      headers,
      payload: {
        provider: 'openai',
        baseUrl: 'https://example.com/v1',
        apiKey: 'catalog-test-key',
      },
    });
    expect(connected.statusCode, connected.body).toBe(201);
    const url = `/v1/admin/ai/sessions/${connected.json<AiChatState>().id}`;
    const proposed = await context.app.inject({
      method: 'POST',
      url: `${url}/messages`,
      headers,
      payload: { model: 'catalog-model', message: 'Proponha a criação no catálogo.' },
    });
    expect(proposed.statusCode, proposed.body).toBe(201);
    const actions = proposed.json<AiChatState>().actions;
    expect(actions).toHaveLength(1);
    const action = actions[0];
    expect(action).toMatchObject({ tool: command.name, status: 'pending', result: null });
    if (!action) throw new Error('Missing catalog proposal.');
    expect(JSON.parse(action.arguments)).toEqual(command.input);
    expect(await counts()).toEqual(before);
    return `${url}/actions/${action.id}`;
  }

  async function approve(url: string): Promise<unknown> {
    const response = await context.app.inject({
      method: 'POST',
      url,
      headers,
      payload: { approved: true },
    });
    expect(response.statusCode, response.body).toBe(201);
    const action = response.json<AiChatState>().actions[0];
    expect(action?.status, response.body).toBe('succeeded');
    expect(action?.result).not.toBeNull();
    return JSON.parse(action?.result ?? 'null');
  }

  it('persists collection and localized name only when approved over HTTP', async () => {
    const input = {
      slug: 'ai-approved-collection',
      name: 'Coleção aprovada',
      emoji: 'FC',
      primaryColor: '#123456',
      secondaryColor: '#abcdef',
      contractsBlocked: true,
    };
    const url = await propose({ name: 'create_collection', input });
    const result = await approve(url);
    const { db, schema, eq } = context.database;
    const rows = await db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.slug, input.slug));
    expect(rows).toHaveLength(1);
    const collection = rows[0];
    if (!collection) throw new Error('Missing approved collection.');
    const { name, ...fields } = input;
    expect(collection).toMatchObject(fields);
    expect(
      await db
        .select()
        .from(schema.localizedTextTranslations)
        .where(eq(schema.localizedTextTranslations.localizedTextId, collection.nameTextId)),
    ).toEqual([expect.objectContaining({ locale: 'pt-BR', content: name })]);
    expect(result).toMatchObject({ id: collection.id, ...input });
  });

  it('persists canonical card and statistics only when approved over HTTP', async () => {
    // ponytail: catálogo usa PostgreSQL real; cobertura de storage exige MinIO separado.
    vi.spyOn(FilesService.prototype, 'defaultCardImage').mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      url: 'https://example.com/default.webp',
      contentType: 'image/webp',
      sizeBytes: 1,
      width: null,
      height: null,
    });
    const statistics = {
      passing: 81,
      control: 82,
      marking: 63,
      pace: 94,
      dribbling: 95,
      finishing: 96,
    };
    const cardFields = {
      ...catalog,
      slug: 'ai-approved-card',
      name: 'Atleta aprovado',
      position: 'CA' as const,
      contractsBlocked: true,
      defense: 71,
      attack: 92,
      creation: 83,
      overall: 85,
    };
    const input: Extract<AiMutation, { name: 'create_card' }>['input'] = {
      ...cardFields,
      ...statistics,
      secondaryPositions: ['PD'],
    };
    const url = await propose({ name: 'create_card', input });
    const result = await approve(url);
    const { db, schema, eq } = context.database;
    const rows = await db.select().from(schema.cards).where(eq(schema.cards.slug, input.slug));
    expect(rows).toHaveLength(1);
    const card = rows[0];
    if (!card) throw new Error('Missing approved card.');
    expect(card).toMatchObject(cardFields);
    expect(
      await db.select().from(schema.cardStats).where(eq(schema.cardStats.id, card.statsId)),
    ).toEqual([expect.objectContaining(statistics)]);
    expect(
      await db
        .select()
        .from(schema.cardSecondaryPositions)
        .where(eq(schema.cardSecondaryPositions.cardId, card.id)),
    ).toEqual([expect.objectContaining({ position: 'PD' })]);
    const { collectionId, teamId, ...fields } = input;
    expect(result).toMatchObject({
      id: card.id,
      ...fields,
      collection: { id: collectionId },
      team: { id: teamId },
    });
  });

  it('persists pack, configuration and filters only when approved over HTTP', async () => {
    const command: Extract<AiMutation, { name: 'create_pack' }> = {
      name: 'create_pack',
      input: {
        name: 'Pack aprovado',
        color: '#102030',
        emoji: 'PK',
        cardsAmount: 3,
        price: 175,
        canBuy: false,
        limitPerUser: 4,
        config: {
          name: 'Filtro aprovado',
          minOverall: 72,
          maxOverall: 91,
          onlyPositions: ['CA'],
          excludedPositions: [],
          onlyCollectionIds: [catalog.collectionId],
          excludedCollectionIds: [],
          onlyCardIds: [],
          excludedCardIds: [],
          onlyTeamIds: [catalog.teamId],
          excludedTeamIds: [],
        },
      },
    };
    const url = await propose(command);
    const result = await approve(url);
    const { db, schema, eq } = context.database;
    const rows = await db
      .select()
      .from(schema.packs)
      .where(eq(schema.packs.name, command.input.name));
    expect(rows).toHaveLength(1);
    const pack = rows[0];
    if (!pack) throw new Error('Missing approved pack.');
    const { config, ...packFields } = command.input;
    expect(pack).toMatchObject({ ...packFields, imageFileId: null });
    const { name, minOverall, maxOverall } = config;
    expect(
      await db.select().from(schema.packConfigs).where(eq(schema.packConfigs.id, pack.configId)),
    ).toEqual([expect.objectContaining({ name, minOverall, maxOverall })]);
    expect(
      await db
        .select()
        .from(schema.packConfigOnlyCollections)
        .where(eq(schema.packConfigOnlyCollections.configId, pack.configId)),
    ).toEqual([expect.objectContaining({ collectionId: catalog.collectionId })]);
    expect(
      await db
        .select()
        .from(schema.packConfigOnlyTeams)
        .where(eq(schema.packConfigOnlyTeams.configId, pack.configId)),
    ).toEqual([expect.objectContaining({ teamId: catalog.teamId })]);
    expect(
      await db
        .select()
        .from(schema.packConfigOnlyPositions)
        .where(eq(schema.packConfigOnlyPositions.configId, pack.configId)),
    ).toEqual([expect.objectContaining({ position: 'CA' })]);
    expect(result).toMatchObject({ id: pack.id, ...command.input, imageUrl: null });
  });
});
