/**
 * O bot já sincroniza os emojis ao iniciar; este script serve para fazer isso sem subir o bot.
 *
 *   pnpm --filter @futhub/discord-bot emojis:sync            cria os que faltam
 *   pnpm --filter @futhub/discord-bot emojis:sync --force    recria todos após editar SVGs
 *   pnpm --filter @futhub/discord-bot emojis:sync --preview  só grava os PNGs em .emoji-preview
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { renderEmoji, syncEmojis } from '../src/core/emoji-sync.js';
import { EMOJI_NAMES } from '../src/core/emojis.js';

const args = new Set(process.argv.slice(2));

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in .env.`);
  return value;
}

if (args.has('--preview')) {
  const previewDir = fileURLToPath(new URL('../.emoji-preview/', import.meta.url));
  await mkdir(previewDir, { recursive: true });
  for (const name of EMOJI_NAMES)
    await writeFile(`${previewDir}${name}.png`, await renderEmoji(name));
  console.log(`${EMOJI_NAMES.length} PNGs em ${previewDir}`);
} else {
  const synced = await syncEmojis({
    token: required('DISCORD_TOKEN'),
    applicationId: required('DISCORD_CLIENT_ID'),
    force: args.has('--force'),
    log: console.log,
  });
  console.log(`${synced.length} emojis sincronizados.`);
}
