import { randomBytes } from 'node:crypto';
import { access, copyFile, readFile, writeFile } from 'node:fs/promises';

const envPath = new URL('../.env', import.meta.url);
const examplePath = new URL('../.env.example', import.meta.url);

try {
  await access(envPath);
} catch {
  await copyFile(examplePath, envPath);
  console.info('Created .env from .env.example.');
}

const contents = await readFile(envPath, 'utf8');
const token = randomBytes(32).toString('hex');
const tokenLine = /^API_INTERNAL_TOKEN=(.*)$/m;
const match = contents.match(tokenLine);

if (match?.[1].trim()) process.exit(0);

const nextContents = match
  ? contents.replace(tokenLine, `API_INTERNAL_TOKEN=${token}`)
  : `${contents}${contents.endsWith('\n') ? '' : '\n'}API_INTERNAL_TOKEN=${token}\n`;

await writeFile(envPath, nextContents);
console.info('Generated API_INTERNAL_TOKEN in .env.');
