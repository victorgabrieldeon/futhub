import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  apiRoot,
  assertMissing,
  assertSlug,
  toPascalCase,
  updateAppModule,
  writeNewFile,
} from './generator-utils.mjs';

const moduleSlug = assertSlug(process.argv[2] ?? '', 'Module name');
const moduleName = toPascalCase(moduleSlug);
const modulesDirectory = resolve(apiRoot, 'src/modules');
const moduleDirectory = resolve(modulesDirectory, moduleSlug);
const appModulePath = resolve(apiRoot, 'src/app.module.ts');

await assertMissing(moduleDirectory);
const appModule = await readFile(appModulePath, 'utf8');
const updatedAppModule = updateAppModule(
  appModule,
  `${moduleName}Module`,
  `./modules/${moduleSlug}/${moduleSlug}.module.js`,
);

await writeNewFile(resolve(moduleDirectory, `${moduleSlug}.dto.ts`), 'export {};\n');
await writeNewFile(
  resolve(moduleDirectory, `${moduleSlug}.controller.ts`),
  `import { Controller } from '@nestjs/common';\n\n@Controller('v1/${moduleSlug}')\nexport class ${moduleName}Controller {}\n`,
);
await writeNewFile(
  resolve(moduleDirectory, `${moduleSlug}.module.ts`),
  `import { Module } from '@nestjs/common';\n\nimport { ${moduleName}Controller } from './${moduleSlug}.controller.js';\n\n@Module({\n  controllers: [${moduleName}Controller],\n  providers: [],\n})\nexport class ${moduleName}Module {}\n`,
);
await writeNewFile(resolve(moduleDirectory, 'repository', '.gitkeep'), '');
await writeNewFile(resolve(moduleDirectory, 'use-cases', '.gitkeep'), '');
await writeFile(appModulePath, updatedAppModule);
console.info(`Created module ${moduleSlug}.`);
