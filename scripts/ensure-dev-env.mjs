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
const requiredVariables = [
  ['API_INTERNAL_TOKEN', () => randomBytes(32).toString('hex')],
  ['ADMIN_API_TOKEN', () => randomBytes(32).toString('hex')],
  ['MINIO_ROOT_USER', () => 'minioadmin'],
  ['MINIO_ROOT_PASSWORD', () => randomBytes(32).toString('hex')],
  ['MINIO_BUCKET', () => 'futhub-card-images'],
  ['MINIO_PUBLIC_URL', () => 'http://s3.futhub.localhost:8080'],
  [
    'ADMIN_DISCORD_REDIRECT_URI',
    () => 'http://admin.futhub.localhost:8080/api/auth/discord/callback',
  ],
];
let nextContents = contents;

for (const [name, createValue] of requiredVariables) {
  const line = new RegExp(`^${name}=(.*)$`, 'm');
  const match = nextContents.match(line);
  if (match?.[1].trim()) continue;

  const value = createValue();
  nextContents = match
    ? nextContents.replace(line, `${name}=${value}`)
    : `${nextContents}${nextContents.endsWith('\n') ? '' : '\n'}${name}=${value}\n`;
}

nextContents = nextContents.replace(
  /^MINIO_PUBLIC_URL=http:\/\/localhost:9002$/m,
  'MINIO_PUBLIC_URL=http://s3.futhub.localhost:8080',
);
nextContents = nextContents.replace(
  /^MINIO_PUBLIC_URL=http:\/\/s3\.futhub\.localhost$/m,
  'MINIO_PUBLIC_URL=http://s3.futhub.localhost:8080',
);
nextContents = nextContents.replace(
  /^ADMIN_DISCORD_REDIRECT_URI=http:\/\/admin\.futhub\.localhost\/api\/auth\/discord\/callback$/m,
  'ADMIN_DISCORD_REDIRECT_URI=http://admin.futhub.localhost:8080/api/auth/discord/callback',
);

if (nextContents === contents) process.exit(0);

await writeFile(envPath, nextContents);
console.info('Generated missing required values in .env.');
