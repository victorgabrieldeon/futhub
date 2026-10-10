import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { createCanvas, loadImage } from '@napi-rs/canvas';

import { type ApplicationEmoji, EMOJI_NAMES, type EmojiName, registerEmojis } from './emojis.js';

export const emojiAssetsDir = fileURLToPath(new URL('../assets/emojis/', import.meta.url));
// Discord exibe emojis em até 128x128; renderizar no tamanho final evita reamostragem dupla.
const SIZE = 128;

export type EmojiSyncOptions = {
  token: string;
  applicationId: string;
  /** Recria os emojis existentes, para publicar SVGs alterados. Os IDs mudam. */
  force?: boolean;
  log?: (message: string) => void;
};

export async function renderEmoji(name: EmojiName): Promise<Buffer> {
  const svg = await readFile(`${emojiAssetsDir}${name}.svg`);
  const canvas = createCanvas(SIZE, SIZE);
  canvas.getContext('2d').drawImage(await loadImage(svg), 0, 0, SIZE, SIZE);
  return canvas.encode('png');
}

/**
 * Garante que cada emoji de `EMOJI_NAMES` exista na aplicação e registra os IDs. Emojis
 * criados pelo painel admin com outros nomes não são tocados.
 */
export async function syncEmojis(options: EmojiSyncOptions): Promise<ApplicationEmoji[]> {
  const discord = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(
      `https://discord.com/api/v10/applications/${options.applicationId}/emojis${path}`,
      {
        ...init,
        headers: { authorization: `Bot ${options.token}`, 'content-type': 'application/json' },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (response.status === 204) return undefined as T;
    if (!response.ok) throw new Error(`Discord ${response.status}: ${await response.text()}`);
    return (await response.json()) as T;
  };

  const { items } = await discord<{ items: ApplicationEmoji[] }>('');
  const existing = new Map(items.map((emoji) => [emoji.name, emoji]));
  const synced: ApplicationEmoji[] = [];
  for (const name of EMOJI_NAMES) {
    const current = existing.get(name);
    if (current && !options.force) {
      synced.push(current);
      continue;
    }
    if (current) await discord<void>(`/${current.id}`, { method: 'DELETE' });
    const png = await renderEmoji(name);
    const created = await discord<ApplicationEmoji>('', {
      method: 'POST',
      body: JSON.stringify({ name, image: `data:image/png;base64,${png.toString('base64')}` }),
    });
    options.log?.(`Emoji ${name} ${current ? 'recriado' : 'criado'} (${created.id}).`);
    synced.push(created);
  }
  registerEmojis(synced);
  return synced;
}
