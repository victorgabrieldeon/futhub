import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';

import {
  type E2eContext,
  adminToken,
  internalToken,
  startE2eContext,
} from '../../../test/e2e/context.js';
import {
  createBotResponseMigrationFixture,
  createPackShopFixture,
} from '../../../test/e2e/entities.js';
import { botResponseCatalog } from '../bot-responses.catalog.js';
import type { BotResponseTemplateDto } from '../bot-responses.dto.js';
import { validateBotResponse } from '../bot-responses.service.js';

let context: E2eContext;
beforeAll(async () => {
  context = await startE2eContext();
}, 60_000);
afterAll(async () => {
  await context?.close();
});

function request(method: 'GET' | 'PUT', url: string, payload?: unknown, token = adminToken) {
  return context.app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    payload: payload === undefined ? undefined : JSON.stringify(payload),
  });
}
const basic: BotResponseTemplateDto = {
  mode: 'legacy',
  content: 'Hello {userName}',
  embeds: [],
  components: [],
};
const button = {
  action: 'pack.shop',
  label: 'Shop',
  style: 'primary',
  url: '',
  disabled: false,
} as const;

test('guards every route, whitelists keys, returns defaults without writing', async () => {
  for (const url of [
    '/v1/admin/bot-responses/schema',
    '/v1/admin/bot-responses/pack.shop',
    '/v1/bot-responses/pack.shop',
    '/v1/packs/shop',
    '/v1/packs/123e4567-e89b-42d3-a456-426614174000',
  ]) {
    expect((await context.app.inject({ method: 'GET', url })).statusCode).toBe(401);
  }
  expect(
    (await request('PUT', '/v1/admin/bot-responses/pack.shop', basic, internalToken)).statusCode,
  ).toBe(401);
  expect(
    (await request('GET', '/v1/bot-responses/pack.shop', undefined, adminToken)).statusCode,
  ).toBe(401);
  expect((await request('GET', '/v1/admin/bot-responses/__proto__')).statusCode).toBe(404);
  expect((await request('PUT', '/v1/admin/bot-responses/arbitrary', basic)).statusCode).toBe(404);
  const schema = await request('GET', '/v1/admin/bot-responses/schema');
  expect(schema.statusCode).toBe(200);
  expect(schema.json()).toEqual(botResponseCatalog);
  const openapi = await context.app.inject({ method: 'GET', url: '/openapi.json' });
  expect(openapi.statusCode).toBe(200);
  const document = openapi.json();
  expect(document.components.schemas.PackShopQueryDto).not.toHaveProperty('required');
  expect(document.paths['/v1/packs/shop'].get.parameters).toContainEqual(
    expect.objectContaining({ name: 'page', in: 'query', required: false }),
  );
  for (const name of ['Text', 'Separator', 'Media', 'Row', 'Container']) {
    expect(document.components.schemas[`BotResponse${name}Dto`].properties.type).toMatchObject({
      type: 'string',
      enum: [name.toLowerCase()],
      title: expect.any(String),
      description: expect.any(String),
    });
  }
  expect(schema.json()).toContainEqual(
    expect.objectContaining({
      key: 'lucro.cooldown',
      label: 'Lucro em espera',
      variables: expect.arrayContaining([
        expect.objectContaining({ token: '{remaining}', example: '7800' }),
      ]),
    }),
  );
  const inspectionDefinition = botResponseCatalog.find(
    (definition) => definition.key === 'pack.inspect',
  );
  expect(inspectionDefinition?.variables.map((variable) => variable.token)).not.toContain(
    '{description}',
  );
  for (const definition of botResponseCatalog) {
    expect(() => validateBotResponse(definition, definition.defaultTemplate)).not.toThrow();
    const result = await request(
      'GET',
      `/v1/bot-responses/${definition.key}`,
      undefined,
      internalToken,
    );
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual(definition.defaultTemplate);
  }
  const rows = await context.database.db
    .select()
    .from(context.database.schema.botResponseTemplates);
  expect(rows.map((row) => row.key)).toEqual(['lucro.success']);
});

test('migration preserves lucro verbatim; legacy economy saves never overwrite templates', async () => {
  const original = await createBotResponseMigrationFixture(context.database);
  const migration = await readFile(
    new URL(
      '../../../../../../packages/database/drizzle/0018_bot_response_templates.sql',
      import.meta.url,
    ),
    'utf8',
  );
  const backfill = migration.split('--> statement-breakpoint')[1];
  if (!backfill) throw new Error('Missing response migration backfill.');
  await context.database.db.execute(context.database.sql.raw(backfill));
  const migrated = await request(
    'GET',
    '/v1/bot-responses/lucro.success',
    undefined,
    internalToken,
  );
  expect(migrated.json().embeds).toEqual([
    { imageUrl: '', thumbnailUrl: '', fields: [], ...original },
  ]);
  expect((await request('PUT', '/v1/admin/bot-responses/lucro.success', basic)).statusCode).toBe(
    200,
  );
  const economy = {
    cooldownSeconds: 60,
    embed: { title: 'Old editor', description: 'Old response', color: '#112233', footer: '' },
    rewards: [{ value: 1, weight: 1, messages: { pt: 'one', es: 'one', en: 'one' } }],
  };
  expect((await request('PUT', '/v1/admin/lucro', economy)).statusCode).toBe(200);
  await context.database.db.execute(context.database.sql.raw(backfill));
  expect(
    (await request('GET', '/v1/bot-responses/lucro.success', undefined, internalToken)).json(),
  ).toEqual(basic);
  const stored = await context.database.db.query.botResponseTemplates.findFirst({
    where: context.database.eq(context.database.schema.botResponseTemplates.key, 'lucro.success'),
  });
  expect(stored?.template).toEqual(basic);
  const legacy = await context.database.db.query.commandConfigs.findFirst({
    where: context.database.eq(context.database.schema.commandConfigs.commandName, 'lucro'),
  });
  expect(legacy).toMatchObject({ cooldownSeconds: 60, embed: economy.embed });
});

test('persists typed V2 components and safe optional image tokens', async () => {
  const template: BotResponseTemplateDto = {
    mode: 'components_v2',
    content: '',
    embeds: [],
    components: [
      {
        type: 'container',
        color: '#112233',
        components: [
          { type: 'text', content: '{packName} {userName}' },
          { type: 'separator', spacing: 2, divider: true },
          { type: 'media', url: '{imageUrl}', description: '{packName}' },
          {
            type: 'row',
            buttons: [
              { ...button, action: 'pack.purchase' },
              {
                ...button,
                action: 'link',
                style: 'link',
                url: 'https://example.com/packs/{packId}',
              },
            ],
          },
        ],
      },
    ],
  };
  const response = await request('PUT', '/v1/admin/bot-responses/pack.inspect', template);
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual(template);
  for (const components of [
    [{ type: 'text', content: '{description}' }],
    [{ type: 'text', content: '{imageUrl}' }],
    [
      { type: 'text', content: 'Outside text does not prevent an empty container.' },
      {
        type: 'container',
        color: '',
        components: [{ type: 'media', url: '{imageUrl}', description: '' }],
      },
    ],
  ]) {
    expect(
      (await request('PUT', '/v1/admin/bot-responses/pack.inspect', { ...template, components }))
        .statusCode,
    ).toBe(400);
  }
  expect((await request('GET', '/v1/admin/bot-responses/pack.inspect')).json()).toEqual(template);
  expect(
    (await request('GET', '/v1/bot-responses/pack.inspect', undefined, internalToken)).json(),
  ).toEqual(template);
  const row = await context.database.db.query.botResponseTemplates.findFirst({
    where: context.database.eq(context.database.schema.botResponseTemplates.key, 'pack.inspect'),
  });
  expect(row?.template).toEqual(template);
});

test('allows 39 container children within the 40-component and 4000-text aggregate limits', async () => {
  const template: BotResponseTemplateDto = {
    mode: 'components_v2',
    content: '',
    embeds: [],
    components: [
      {
        type: 'container',
        color: '',
        components: Array.from({ length: 39 }, () => ({ type: 'text', content: 'x' })),
      },
    ],
  };
  expect((await request('PUT', '/v1/admin/bot-responses/pack.open', template)).statusCode).toBe(
    200,
  );
  const tooMany = {
    ...template,
    components: [...template.components, { type: 'text', content: '41st component' }],
  };
  expect((await request('PUT', '/v1/admin/bot-responses/pack.open', tooMany)).statusCode).toBe(400);
  expect(
    (
      await request('PUT', '/v1/admin/bot-responses/pack.open', {
        ...template,
        components: [
          {
            type: 'container',
            color: '',
            components: Array.from({ length: 40 }, () => ({ type: 'text', content: 'x' })),
          },
        ],
      })
    ).statusCode,
  ).toBe(400);
  const stored = await context.database.db.query.botResponseTemplates.findFirst({
    where: context.database.eq(context.database.schema.botResponseTemplates.key, 'pack.open'),
  });
  expect(stored?.template).toEqual(template);

  const text: BotResponseTemplateDto = {
    ...template,
    components: [
      { type: 'text', content: 'x'.repeat(2000) },
      { type: 'text', content: 'y'.repeat(2000) },
    ],
  };
  expect((await request('PUT', '/v1/admin/bot-responses/pack.open', text)).statusCode).toBe(200);
  expect(
    (
      await request('PUT', '/v1/admin/bot-responses/pack.open', {
        ...text,
        components: [...text.components, { type: 'text', content: 'x' }],
      })
    ).statusCode,
  ).toBe(400);
  const persisted = await context.database.db.query.botResponseTemplates.findFirst({
    where: context.database.eq(context.database.schema.botResponseTemplates.key, 'pack.open'),
  });
  expect(persisted?.template).toEqual(text);
});

test('persists and returns embed author metadata and thumbnail', async () => {
  const template = {
    ...basic,
    content: '',
    embeds: [
      {
        title: 'Pack',
        description: '',
        color: '#2B2D31',
        footer: '',
        authorName: 'FutHub',
        authorUrl: 'https://example.com/futhub',
        authorIconUrl: 'https://example.com/futhub.png',
        imageUrl: '',
        thumbnailUrl: 'https://example.com/pack.png',
        fields: [],
      },
    ],
  };
  const updated = await request('PUT', '/v1/admin/bot-responses/pack.open', template);
  expect(updated.statusCode).toBe(200);
  expect(updated.json()).toEqual(template);
  expect((await request('GET', '/v1/admin/bot-responses/pack.open')).json()).toEqual(template);
  const stored = await context.database.db.query.botResponseTemplates.findFirst({
    where: context.database.eq(context.database.schema.botResponseTemplates.key, 'pack.open'),
  });
  expect(stored?.template).toEqual(template);
});

test('rejects example-expanded limits without changing the stored template', async () => {
  const embed = {
    title: 'Pack',
    description: '',
    color: '',
    footer: '',
    imageUrl: '',
    thumbnailUrl: '',
    fields: [],
  };
  const token = '{packId}';
  const invalid: BotResponseTemplateDto[] = [
    { ...basic, components: [{ type: 'row', buttons: [{ ...button, label: token.repeat(3) }] }] },
    { ...basic, content: token.repeat(56) },
    ...[
      { title: token.repeat(8) },
      { description: token.repeat(114) },
      { footer: token.repeat(57) },
      { fields: [{ name: token.repeat(8), value: 'Value', inline: false }] },
      { fields: [{ name: 'Name', value: token.repeat(29), inline: false }] },
    ].map((change) => ({ ...basic, embeds: [{ ...embed, ...change }] })),
    {
      ...basic,
      embeds: [
        { ...embed, description: token.repeat(84) },
        { ...embed, description: token.repeat(84) },
      ],
    },
    {
      ...basic,
      components: [
        {
          type: 'row',
          buttons: [
            {
              ...button,
              action: 'link',
              style: 'link',
              url: `https://example.com/${token.repeat(14)}`,
            },
          ],
        },
      ],
    },
    {
      mode: 'components_v2',
      content: '',
      embeds: [],
      components: [{ type: 'text', content: token.repeat(112) }],
    },
    {
      mode: 'components_v2',
      content: '',
      embeds: [],
      components: [
        {
          type: 'container',
          color: '',
          components: [
            { type: 'text', content: token.repeat(56) },
            { type: 'text', content: token.repeat(56) },
          ],
        },
      ],
    },
  ];
  expect((await request('PUT', '/v1/admin/bot-responses/pack.inspect', basic)).statusCode).toBe(
    200,
  );
  for (const template of invalid) {
    expect(
      (await request('PUT', '/v1/admin/bot-responses/pack.inspect', template)).statusCode,
      JSON.stringify(template),
    ).toBe(400);
  }
  const row = await context.database.db.query.botResponseTemplates.findFirst({
    where: context.database.eq(context.database.schema.botResponseTemplates.key, 'pack.inspect'),
  });
  expect(row?.template).toEqual(basic);

  const definition = botResponseCatalog.find((entry) => entry.key === 'pack.inspect');
  if (!definition) throw new Error('Missing inspection definition.');
  expect(() =>
    validateBotResponse(
      {
        ...definition,
        variables: definition.variables.map((variable) => ({
          ...variable,
          example: variable.token === token ? '{userName}{unregistered}' : 'x'.repeat(81),
        })),
      },
      {
        ...basic,
        content: 'Pack',
        components: [{ type: 'row', buttons: [{ ...button, label: token }] }],
      },
    ),
  ).not.toThrow();
});

test('rejects malformed, unsafe and over-limit payloads without changing persistence', async () => {
  const embed = {
    title: 'Title',
    description: '',
    color: '',
    footer: '',
    imageUrl: '',
    thumbnailUrl: '',
    fields: [],
  };
  const invalid: unknown[] = [
    {},
    null,
    { ...basic, arbitrary: 'javascript' },
    { ...basic, mode: 'raw' },
    { ...basic, content: '' },
    { ...basic, content: 'x'.repeat(2001) },
    { ...basic, content: '{packId}' },
    { ...basic, content: '{unknown}' },
    { ...basic, content: '{{userName}}' },
    { ...basic, embeds: Array.from({ length: 11 }, () => embed) },
    {
      ...basic,
      embeds: [
        { ...embed, description: 'x'.repeat(4000) },
        { ...embed, description: 'x'.repeat(2000) },
      ],
    },
    {
      ...basic,
      embeds: [
        {
          ...embed,
          fields: Array.from({ length: 26 }, () => ({ name: 'n', value: 'v', inline: false })),
        },
      ],
    },
    { ...basic, embeds: [{ ...embed, fields: [{ name: 'n', value: '{packId}', inline: false }] }] },
    { ...basic, embeds: [{ ...embed, color: 'red' }] },
    { ...basic, embeds: [{ ...embed, imageUrl: 'javascript:alert(1)' }] },
    { ...basic, embeds: [{ ...embed, thumbnailUrl: 'file:///etc/passwd' }] },
    { ...basic, components: [{ type: 'section', content: 'unsupported' }] },
    { ...basic, components: [{ type: 'row', buttons: [{ ...button, action: 'pack.purchase' }] }] },
    { ...basic, components: [{ type: 'row', buttons: [{ ...button, action: 'execute' }] }] },
    { ...basic, components: [{ type: 'row', buttons: [{ ...button, custom_id: 'arbitrary' }] }] },
    { ...basic, components: [{ type: 'row', buttons: [{ ...button, style: 'link' }] }] },
    {
      ...basic,
      components: [{ type: 'row', buttons: [{ ...button, url: 'https://example.com' }] }],
    },
    {
      ...basic,
      components: [
        {
          type: 'row',
          buttons: [{ ...button, action: 'link', style: 'link', url: 'data:text/html,test' }],
        },
      ],
    },
    { ...basic, components: [{ type: 'row', buttons: Array.from({ length: 6 }, () => button) }] },
    { ...basic, components: Array.from({ length: 6 }, () => ({ type: 'row', buttons: [button] })) },
    { ...basic, components: [{ type: 'text', content: 'V2 only' }] },
    { ...basic, mode: 'components_v2', components: [{ type: 'text', content: 'Mixed mode' }] },
    {
      mode: 'components_v2',
      content: '',
      embeds: [embed],
      components: [{ type: 'text', content: 'Mixed embed' }],
    },
    {
      mode: 'components_v2',
      content: '',
      embeds: [],
      components: [{ type: 'separator', spacing: 1, divider: false }],
    },
    {
      mode: 'components_v2',
      content: '',
      embeds: [],
      components: [
        {
          type: 'container',
          color: '',
          components: [{ type: 'container', color: '', components: [] }],
        },
      ],
    },
    {
      mode: 'components_v2',
      content: '',
      embeds: [],
      components: [
        { type: 'text', content: 'x'.repeat(2001) },
        { type: 'text', content: 'x'.repeat(2000) },
      ],
    },
    {
      mode: 'components_v2',
      content: '',
      embeds: [],
      components: Array.from({ length: 7 }, () => ({
        type: 'row',
        buttons: Array.from({ length: 5 }, () => button),
      })),
    },
  ];
  await request('PUT', '/v1/admin/bot-responses/pack.shop', basic);
  for (const payload of invalid) {
    const response = await request('PUT', '/v1/admin/bot-responses/pack.shop', payload);
    expect(response.statusCode, JSON.stringify(payload)).toBe(400);
  }
  const row = await context.database.db.query.botResponseTemplates.findFirst({
    where: context.database.eq(context.database.schema.botResponseTemplates.key, 'pack.shop'),
  });
  expect(row?.template).toEqual(basic);
});

test('shop paginates purchasable packs; inspection matches persisted state and validates inputs', async () => {
  const ids = await createPackShopFixture(context.database);
  const firstId = ids[0];
  if (!firstId) throw new Error('Missing shop fixture.');
  const shop = await request('GET', '/v1/packs/shop', undefined, internalToken);
  expect(shop.statusCode).toBe(200);
  expect(shop.json()).toMatchObject({ page: 1, totalPages: 2 });
  expect(shop.json().packs.map((pack: { id: string }) => pack.id)).toEqual(ids.slice(0, 5));
  const second = await request('GET', '/v1/packs/shop?page=2', undefined, internalToken);
  expect(second.json().packs.map((pack: { id: string }) => pack.id)).toEqual(ids.slice(5, 6));
  expect(
    (await request('GET', '/v1/packs/shop?page=3', undefined, internalToken)).json().packs,
  ).toEqual([]);
  const inspection = await request('GET', `/v1/packs/${ids[0]}`, undefined, internalToken);
  expect(inspection.statusCode).toBe(200);
  expect(inspection.json()).toEqual(shop.json().packs[0]);
  expect(inspection.json()).not.toHaveProperty('description');
  expect(inspection.json()).toMatchObject({
    imageUrl: 'https://example.com/pack.png',
    price: 10,
    cardsPerPack: 3,
  });
  const persisted = await context.database.db.query.packs.findFirst({
    where: context.database.eq(context.database.schema.packs.id, firstId),
  });
  expect(persisted).toMatchObject({
    canBuy: true,
    name: inspection.json().name,
    price: inspection.json().price,
  });
  expect((await request('GET', `/v1/packs/${ids[6]}`, undefined, internalToken)).statusCode).toBe(
    404,
  );
  expect(
    (
      await request(
        'GET',
        '/v1/packs/123e4567-e89b-42d3-a456-426614174000',
        undefined,
        internalToken,
      )
    ).statusCode,
  ).toBe(404);
  expect((await request('GET', '/v1/packs/not-a-uuid', undefined, internalToken)).statusCode).toBe(
    400,
  );
  for (const page of ['0', '-1', '1.5', 'nope', '999999999999'])
    expect(
      (await request('GET', `/v1/packs/shop?page=${page}`, undefined, internalToken)).statusCode,
    ).toBe(400);
});
