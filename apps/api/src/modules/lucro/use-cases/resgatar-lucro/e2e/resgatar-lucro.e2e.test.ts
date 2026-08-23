import { afterAll, beforeAll, expect, test } from 'vitest';

import {
  type E2eContext,
  internalToken,
  startE2eContext,
} from '../../../../../test/e2e/context.js';

let context: E2eContext | undefined;

beforeAll(async () => {
  context = await startE2eContext();
}, 120_000);

afterAll(async () => {
  await context?.close();
});

test('exposes public health check', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app } = context;

  const response = await app.inject({ method: 'GET', url: '/health' });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok' });
});

test('protects lucro with internal authentication', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app } = context;

  const response = await app.inject({
    method: 'POST',
    url: '/v1/commands/lucro',
    payload: { id: '123456789012345678', name: 'Nome', avatarUrl: null },
  });

  expect(response.statusCode).toBe(401);
});

test('validates lucro identity', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app } = context;

  const response = await app.inject({
    method: 'POST',
    url: '/v1/commands/lucro',
    headers: { authorization: `Bearer ${internalToken}` },
    payload: { id: '', name: 'Nome', avatarUrl: null },
  });

  expect(response.statusCode).toBe(400);
});

test('expõe schema da embed do lucro para o painel', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app } = context;

  const schema = await app.inject({
    method: 'GET',
    url: '/v1/commands/lucro/schema',
    headers: { authorization: `Bearer ${internalToken}` },
  });

  expect(schema.statusCode).toBe(200);
  const contract = schema.json();
  expect(contract).toMatchObject({
    data: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'Embed do comando /lucro',
      type: 'object',
      properties: {
        description: {
          maxLength: 4096,
          examples: [expect.stringContaining('{message}')],
        },
        color: { pattern: '^#[0-9A-Fa-f]{6}$', examples: ['#22c55e'] },
      },
      examples: [
        {
          title: 'Lucro resgatado',
          color: '#22c55e',
        },
      ],
    },
    contexto: {
      title: 'Contexto do usuário',
      properties: {
        balance: { type: 'integer', example: '4250' },
        booster: { type: 'boolean', example: 'false' },
      },
    },
  });
  expect(contract.data.variables).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        token: '{message}',
        description: expect.any(String),
        example: 'Lucro raro: +500',
      }),
      expect.objectContaining({ token: '{availableAt}', example: 'amanhã às 12:00' }),
    ]),
  );
  expect(contract.utilities).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'formatNumber',
        signature: 'formatNumber(value, locale)',
        example: "formatNumber(4250, 'pt-BR') = '4.250'",
      }),
      expect.objectContaining({ name: 'formatDateTime' }),
      expect.objectContaining({ name: 'formatDuration' }),
      expect.objectContaining({ name: 'bold' }),
    ]),
  );

  const unknown = await app.inject({
    method: 'GET',
    url: '/v1/commands/outro/schema',
    headers: { authorization: `Bearer ${internalToken}` },
  });
  expect(unknown.statusCode).toBe(404);
});
test('admin atualiza a configuração do lucro e persiste recompensas', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;

  const current = await app.inject({
    method: 'GET',
    url: '/v1/admin/lucro',
    headers: { authorization: `Bearer ${internalToken}` },
  });
  expect(current.statusCode).toBe(200);
  expect(current.json()).toMatchObject({ cooldownSeconds: expect.any(Number) });

  const response = await app.inject({
    method: 'PUT',
    url: '/v1/admin/lucro',
    headers: { authorization: `Bearer ${internalToken}` },
    payload: {
      cooldownSeconds: 900,
      rewards: [
        {
          value: 75,
          weight: 4,
          messages: {
            pt: 'Lucro inicial: +75',
            es: 'Ganancia inicial: +75',
            en: 'Initial profit: +75',
          },
        },
        {
          value: 400,
          weight: 1,
          messages: {
            pt: 'Lucro raro: +400',
            es: 'Ganancia rara: +400',
            en: 'Rare profit: +400',
          },
        },
      ],
      embed: {
        title: 'Resultado do lucro',
        description: '{message} | saldo: {balance}',
        color: '#2563eb',
        footer: 'FutHub teste',
      },
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    cooldownSeconds: 900,
    rewards: [
      {
        value: 75,
        weight: 4,
        messages: {
          pt: 'Lucro inicial: +75',
          es: 'Ganancia inicial: +75',
          en: 'Initial profit: +75',
        },
      },
      {
        value: 400,
        weight: 1,
        messages: {
          pt: 'Lucro raro: +400',
          es: 'Ganancia rara: +400',
          en: 'Rare profit: +400',
        },
      },
    ],
    embed: {
      title: 'Resultado do lucro',
      description: '{message} | saldo: {balance}',
      color: '#2563eb',
      footer: 'FutHub teste',
    },
  });

  const config = await database.db.query.commandConfigs.findFirst({
    columns: {
      id: true,
      cooldownSeconds: true,
      embedTitle: true,
      embedDescription: true,
      embedColor: true,
      embedFooter: true,
    },
    where: database.eq(database.schema.commandConfigs.commandName, 'lucro'),
  });
  expect(config).toMatchObject({
    cooldownSeconds: 900,
    embedTitle: 'Resultado do lucro',
    embedDescription: '{message} | saldo: {balance}',
    embedColor: '#2563eb',
    embedFooter: 'FutHub teste',
  });
  if (!config) throw new Error('Lucro configuration was not persisted.');
  const rewards = await database.db.query.commandRewards.findMany({
    columns: { value: true, weight: true, messageTextId: true },
    where: database.eq(database.schema.commandRewards.commandConfigId, config.id),
  });
  expect(rewards).toHaveLength(2);
  const translations = await database.db.query.localizedTextTranslations.findMany({
    columns: { localizedTextId: true, locale: true, content: true },
    where: database.inArray(
      database.schema.localizedTextTranslations.localizedTextId,
      rewards.map((reward) => reward.messageTextId),
    ),
  });
  expect(translations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ locale: 'pt', content: 'Lucro inicial: +75' }),
      expect.objectContaining({ locale: 'es', content: 'Ganancia inicial: +75' }),
      expect.objectContaining({ locale: 'en', content: 'Initial profit: +75' }),
      expect.objectContaining({ locale: 'pt', content: 'Lucro raro: +400' }),
      expect.objectContaining({ locale: 'es', content: 'Ganancia rara: +400' }),
      expect.objectContaining({ locale: 'en', content: 'Rare profit: +400' }),
    ]),
  );
});

test('resgata lucro once and enters cooldown', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app: application } = context;
  const request = () =>
    application.inject({
      method: 'POST',
      url: '/v1/commands/lucro',
      headers: { authorization: `Bearer ${internalToken}` },
      payload: { id: '123456789012345678', name: 'Nome', avatarUrl: null },
    });

  const success = await request();
  const successBody = success.json();
  expect(success.statusCode).toBe(200);
  expect(successBody).toMatchObject({
    kind: 'success',
    progression: { gainedXp: 10, level: 1, xp: 10, nextLevelXp: 100, rewards: [] },
    embed: {
      title: 'Resultado do lucro',
      description: '{message} | saldo: {balance}',
      color: '#2563eb',
      footer: 'FutHub teste',
    },
  });

  const cooldown = await request();
  expect(cooldown.statusCode).toBe(200);
  expect(cooldown.json()).toEqual({
    kind: 'cooldown',
    availableAt: successBody.availableAt,
  });
});

test('resgata lucro com mensagem no idioma do usuário', async () => {
  if (!context) throw new Error('E2E context was not initialized.');
  const { app, database } = context;
  await database.db.insert(database.schema.users).values({
    discordUserId: 'localized-user',
    nome: 'Nombre',
    urlAvatar: null,
    language: 'es-ES',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/v1/commands/lucro',
    headers: { authorization: `Bearer ${internalToken}` },
    payload: { id: 'localized-user', name: 'Nombre', avatarUrl: null },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    kind: 'success',
    reward: { message: expect.stringMatching(/^Ganancia (inicial|rara): \+/) },
  });
});
