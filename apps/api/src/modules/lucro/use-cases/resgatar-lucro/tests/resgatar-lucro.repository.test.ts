import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { ResgatarLucroRepository } from '../resgatar-lucro.types.js';
import { ResgatarLucroUseCase } from '../resgatar-lucro.use-case.js';

const execFileAsync = promisify(execFile);
const command = {
  name: 'lucro-test',
  cooldownSeconds: 10,
  rewards: [{ value: 50, weight: 1, message: 'Primeiro' }],
  embed: { title: 'Lucro', description: '{message}', color: '#22c55e', footer: 'FutHub' },
};
const identity = {
  id: '123456789012345678',
  name: 'Nome',
  avatarUrl: 'https://example.com/avatar.png',
};

let container: StartedTestContainer | undefined;
let database: typeof import('@futhub/database') | undefined;
let repository: ResgatarLucroRepository | undefined;

function useCase(subject: ResgatarLucroRepository): ResgatarLucroUseCase {
  return new ResgatarLucroUseCase(subject, { now: () => new Date() }, { next: () => 0 });
}

beforeAll(async () => {
  container = await new GenericContainer('postgres:17-alpine')
    .withEnvironment({
      POSTGRES_DB: 'futhub_test',
      POSTGRES_USER: 'futhub',
      POSTGRES_PASSWORD: 'futhub',
    })
    .withExposedPorts(5432)
    .withHealthCheck({
      test: ['CMD-SHELL', 'pg_isready -U futhub -d futhub_test'],
      interval: 1_000,
      timeout: 5_000,
      retries: 10,
    })
    .withWaitStrategy(Wait.forHealthCheck())
    .start();
  process.env.DATABASE_URL = `postgresql://futhub:futhub@${container.getHost()}:${container.getMappedPort(5432)}/futhub_test`;
  await execFileAsync('pnpm', ['--filter', '@futhub/database', 'db:migrate'], {
    cwd: process.cwd(),
    env: process.env,
  });
  const loadedDatabase = await import('@futhub/database');
  database = loadedDatabase;
  repository = new (
    await import('../../../repository/resgatar-lucro.repository.js')
  ).DrizzleResgatarLucroRepository(async () => loadedDatabase);
}, 120_000);

beforeEach(async () => {
  if (!database) throw new Error('Database was not initialized.');
  await database.db.delete(database.schema.levelRewards);
  await database.db.delete(database.schema.items);
  await database.db.delete(database.schema.userCooldowns);
  await database.db.delete(database.schema.commandRewards);
  await database.db.delete(database.schema.commandConfigs);
  await database.db.delete(database.schema.users);
});

afterAll(async () => {
  await database?.pool.end();
  await container?.stop();
});

describe('DrizzleResgatarLucroRepository', () => {
  it('creates state and executes lucro', async () => {
    if (!repository) throw new Error('Repository was not initialized.');

    const result = await useCase(repository).execute(
      identity,
      command,
      new Date('2026-08-15T12:00:00.000Z'),
      0,
    );

    expect(result).toEqual({
      kind: 'success',
      reward: { value: 50, weight: 1, message: 'Primeiro' },
      balance: 50,
      progression: { gainedXp: 10, level: 1, xp: 10, nextLevelXp: 100, rewards: [] },
      availableAt: new Date('2026-08-15T12:00:10.000Z'),
      embed: command.embed,
    });
  });

  it('grants a configured level reward atomically', async () => {
    if (!database || !repository) throw new Error('Repository was not initialized.');
    const [item] = await database.db
      .insert(database.schema.items)
      .values({ type: 'balance', amount: 25 })
      .returning({ id: database.schema.items.id });
    if (!item) throw new Error('Failed to create reward item.');
    await database.db.insert(database.schema.levelRewards).values({ level: 1, itemId: item.id });
    await database.db.insert(database.schema.users).values({
      discordUserId: identity.id,
      nome: identity.name,
      urlAvatar: identity.avatarUrl,
      xp: 90,
      level: 1,
    });

    await expect(
      useCase(repository).execute(identity, command, new Date('2026-08-15T12:00:00.000Z'), 0),
    ).resolves.toEqual({
      kind: 'success',
      reward: { value: 50, weight: 1, message: 'Primeiro' },
      balance: 75,
      availableAt: new Date('2026-08-15T12:00:10.000Z'),
      progression: {
        gainedXp: 10,
        level: 2,
        xp: 0,
        nextLevelXp: 250,
        rewards: [{ itemId: item.id, type: 'balance', quantity: 25, resourceId: null }],
      },
      embed: command.embed,
    });
  });

  it('grants one reward for concurrent calls in the same window', async () => {
    if (!repository) throw new Error('Repository was not initialized.');
    const now = new Date('2026-08-15T12:00:00.000Z');

    const results = await Promise.all([
      useCase(repository).execute(identity, command, now, 0),
      useCase(repository).execute(identity, command, now, 0),
    ]);

    expect(results.map(({ kind }) => kind).sort()).toEqual(['cooldown', 'success']);
  });

  it('rolls back credit when the transaction operation fails', async () => {
    if (!repository) throw new Error('Repository was not initialized.');
    const now = new Date('2026-08-15T12:00:00.000Z');
    await expect(
      repository.run(command, identity, now, async (transaction) => {
        await transaction.credit(50);
        throw new Error('Cooldown write failed.');
      }),
    ).rejects.toThrow('Cooldown write failed.');

    const result = await useCase(repository).execute(identity, command, now, 0);

    expect(result).toMatchObject({ kind: 'success', balance: 50 });
  });

  it('uses persisted cooldown configuration after defaults exist', async () => {
    if (!repository) throw new Error('Repository was not initialized.');
    const subject = useCase(repository);
    await subject.execute(identity, command, new Date('2026-08-15T12:00:00.000Z'), 0);

    const result = await subject.execute(
      identity,
      { ...command, cooldownSeconds: 999 },
      new Date('2026-08-15T12:00:10.000Z'),
      0,
    );

    expect(result).toMatchObject({
      kind: 'success',
      availableAt: new Date('2026-08-15T12:00:20.000Z'),
    });
  });

  it('creates defaults once while different users execute concurrently', async () => {
    if (!repository) throw new Error('Repository was not initialized.');
    const now = new Date('2026-08-15T12:00:00.000Z');

    const results = await Promise.all([
      useCase(repository).execute(identity, command, now, 0),
      useCase(repository).execute({ ...identity, id: '987654321098765432' }, command, now, 0),
    ]);

    expect(results).toMatchObject([
      { kind: 'success', balance: 50 },
      { kind: 'success', balance: 50 },
    ]);
  });
});
