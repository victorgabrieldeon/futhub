import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const moduleGenerator = join(scriptsDirectory, 'generate-module.mjs');
const useCaseGenerator = join(scriptsDirectory, 'generate-usecase.mjs');

async function run(root, script, ...args) {
  return execFile(process.execPath, [script, ...args], {
    env: { ...process.env, DREAMFUT_API_ROOT: root },
  });
}

test('generates a registered module and a delegating use case', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dreamfut-api-'));
  t.after(() => rm(root, { force: true, recursive: true }));
  await mkdir(join(root, 'src/modules'), { recursive: true });
  await writeFile(
    join(root, 'src/app.module.ts'),
    `import { Module } from '@nestjs/common';\n\nimport { AuthModule } from './modules/auth/auth.module.js';\n\n@Module({\n  imports: [\n    AuthModule,\n  ],\n})\nexport class AppModule {}\n`,
  );

  await run(root, moduleGenerator, 'recompensas');
  await run(root, useCaseGenerator, 'recompensas', 'resgatar-recompensa');

  const appModule = await readFile(join(root, 'src/app.module.ts'), 'utf8');
  const controller = await readFile(
    join(root, 'src/modules/recompensas/recompensas.controller.ts'),
    'utf8',
  );
  const useCase = await readFile(
    join(
      root,
      'src/modules/recompensas/use-cases/resgatar-recompensa/resgatar-recompensa.use-case.ts',
    ),
    'utf8',
  );
  const useCaseTest = await readFile(
    join(
      root,
      'src/modules/recompensas/use-cases/resgatar-recompensa/tests/resgatar-recompensa.use-case.test.ts',
    ),
    'utf8',
  );

  assert.match(appModule, /RecompensasModule/);
  assert.match(controller, /@Controller\('v1\/recompensas'\)/);
  assert.match(useCase, /return this\.repository\.execute\(input\);/);
  assert.match(useCaseTest, /delegates input to repository/);
  await assert.rejects(() => run(root, moduleGenerator, 'recompensas'), /already exists/);
});
