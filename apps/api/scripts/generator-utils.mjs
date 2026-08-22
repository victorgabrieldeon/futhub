import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const apiRoot = resolve(process.env.FUTHUB_API_ROOT ?? resolve(scriptDirectory, '..'));

export function toPascalCase(value) {
  return value
    .split('-')
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join('');
}

export function assertSlug(value, label) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value))
    throw new Error(`${label} must use lowercase letters, numbers, and hyphens.`);
  return value;
}

export async function assertMissing(path) {
  try {
    await access(path);
  } catch {
    return;
  }
  throw new Error(`${path} already exists.`);
}

export async function assertExists(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`${path} does not exist.`);
  }
}

export async function writeNewFile(path, content) {
  await assertMissing(path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

export function updateAppModule(source, moduleName, modulePath) {
  const importLine = `import { ${moduleName} } from '${modulePath}';`;
  if (source.includes(importLine)) throw new Error(`${moduleName} is already registered.`);

  const imports = source.match(/((?:import .* from '\.\/modules\/.*\.module\.js';\n)+)\n@Module/);
  if (!imports) throw new Error('Could not find module imports in src/app.module.ts.');
  const sortedImports = [...imports[1].trimEnd().split('\n'), importLine].sort().join('\n');
  const withImport = source.replace(imports[0], `${sortedImports}\n\n@Module`);

  const modules = withImport.match(/^[ ]{2}imports: \[\n([\s\S]*?)\n[ ]{2}\],/m);
  if (!modules) throw new Error('Could not find AppModule imports array.');
  const sortedModules = [...modules[1].split('\n').map((line) => line.trim()), `${moduleName},`]
    .sort()
    .map((line) => `    ${line}`)
    .join('\n');
  return withImport.replace(modules[0], `  imports: [\n${sortedModules}\n  ],`);
}
