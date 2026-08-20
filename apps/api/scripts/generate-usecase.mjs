import { resolve } from 'node:path';

import {
  apiRoot,
  assertExists,
  assertMissing,
  assertSlug,
  toPascalCase,
  writeNewFile,
} from './generator-utils.mjs';

const moduleSlug = assertSlug(process.argv[2] ?? '', 'Module name');
const useCaseSlug = assertSlug(process.argv[3] ?? '', 'Use case name');
const moduleDirectory = resolve(apiRoot, 'src/modules', moduleSlug);
const useCaseDirectory = resolve(moduleDirectory, 'use-cases', useCaseSlug);
const useCaseName = toPascalCase(useCaseSlug);

await assertExists(moduleDirectory);
await assertMissing(useCaseDirectory);

await writeNewFile(
  resolve(useCaseDirectory, `${useCaseSlug}.types.ts`),
  `export type ${useCaseName}Input = Readonly<Record<string, never>>;\n\nexport type ${useCaseName}Output = Readonly<Record<string, never>>;\n\nexport abstract class ${useCaseName}Repository {\n  abstract execute(input: ${useCaseName}Input): Promise<${useCaseName}Output>;\n}\n`,
);
await writeNewFile(
  resolve(useCaseDirectory, `${useCaseSlug}.use-case.ts`),
  `import type {\n  ${useCaseName}Input,\n  ${useCaseName}Output,\n  ${useCaseName}Repository,\n} from './${useCaseSlug}.types.js';\n\nexport class ${useCaseName}UseCase {\n  constructor(private readonly repository: ${useCaseName}Repository) {}\n\n  execute(input: ${useCaseName}Input): Promise<${useCaseName}Output> {\n    return this.repository.execute(input);\n  }\n}\n`,
);
await writeNewFile(
  resolve(useCaseDirectory, 'tests', `${useCaseSlug}.use-case.test.ts`),
  `import { describe, expect, it } from 'vitest';\n\nimport type {\n  ${useCaseName}Input,\n  ${useCaseName}Output,\n  ${useCaseName}Repository,\n} from '../${useCaseSlug}.types.js';\nimport { ${useCaseName}UseCase } from '../${useCaseSlug}.use-case.js';\n\ndescribe('${useCaseName}UseCase', () => {\n  it('delegates input to repository', async () => {\n    const input: ${useCaseName}Input = {};\n    const output: ${useCaseName}Output = {};\n    const repository: ${useCaseName}Repository = {\n      execute: async (received) => {\n        expect(received).toBe(input);\n        return output;\n      },\n    };\n\n    await expect(new ${useCaseName}UseCase(repository).execute(input)).resolves.toBe(output);\n  });\n});\n`,
);
console.info(`Created ${useCaseSlug} use case in ${moduleSlug}.`);
