import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../openapi.json', import.meta.url);
const document = JSON.parse(await readFile(path, 'utf8'));

// ponytail: Remove when Nestia stops emitting null annotations for Zod-inferred literals.
function removeInvalidAnnotations(value) {
  if (!value || typeof value !== 'object') return;
  if (value.title === null) value.title = undefined;
  if (value.description === null) value.description = undefined;
  for (const nested of Object.values(value)) removeInvalidAnnotations(nested);
}

removeInvalidAnnotations(document);
await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
