import { getBotResponse, request } from '@futhub/api-client';
import {
  type BotEmoji,
  type Definition,
  type Template,
  type TemplateData,
  createScope,
  definition,
  drawCanvas,
  render,
} from '@futhub/bot-templates';
import { type Image, createCanvas, loadImage } from '@napi-rs/canvas';
import type { CommandContext } from 'seyfert';

import { EMOJI_FALLBACK, isEmojiName, registeredEmojis } from './emojis.js';
import { imageFont } from './image-fonts.js';

export type BotMessage = Parameters<CommandContext['write']>[0];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TTL_MS = 10 * 60_000;
const images = new Map<string, { at: number; image: Promise<Image | null> }>();

async function fetchImage(url: string): Promise<Image | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(4_000), redirect: 'follow' });
  if (!response.ok) return null;
  if (Number(response.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return null;
  const body = Buffer.from(await response.arrayBuffer());
  return body.length > MAX_IMAGE_BYTES ? null : loadImage(body);
}

// Pack art and avatars repeat across replies; failures are cached too so a dead URL stays cheap.
function cachedImage(url: string): Promise<Image | null> {
  const now = Date.now();
  const hit = images.get(url);
  if (hit && now - hit.at < IMAGE_TTL_MS) return hit.image;
  const image = fetchImage(url).catch(() => null);
  images.set(url, { at: now, image });
  if (images.size > 64) images.delete(images.keys().next().value ?? '');
  return image;
}

let emojiCache: { at: number; emojis: Promise<readonly BotEmoji[]> } | undefined;

function applicationEmojis(): Promise<readonly BotEmoji[]> {
  if (emojiCache && Date.now() - emojiCache.at < 60_000) return emojiCache.emojis;
  const emojis = request<{ emojis: BotEmoji[] }>('/v1/bot-emojis', { method: 'GET' })
    .then((result) => result.emojis)
    .catch((error) => {
      console.error('Failed to load bot emojis.', error);
      emojiCache = undefined;
      return [];
    });
  emojiCache = { at: Date.now(), emojis };
  return emojis;
}

// The bot's own emojis are already registered at startup; only emojis uploaded through the
// admin panel need the API lookup, which is cached for a minute.
async function emojisFor(entry: Definition, template: Template): Promise<readonly BotEmoji[]> {
  const json = JSON.stringify([template, entry.lists.map((list) => list.defaultFormat)]);
  const names = [
    ...json.matchAll(/\{emoji:([A-Za-z0-9_]{2,32})\}|"emoji":"([A-Za-z0-9_]{2,32})"/g),
  ].map((match) => match[1] ?? match[2] ?? '');
  const own = registeredEmojis().map((emoji) => ({ ...emoji, animated: emoji.animated === true }));
  if (names.every(isEmojiName)) return own;
  return [...(await applicationEmojis()), ...own];
}

function emojiFallback(name: string): string | undefined {
  return isEmojiName(name) ? EMOJI_FALLBACK[name] : undefined;
}

async function build(
  entry: Definition,
  template: Template,
  data: TemplateData,
): Promise<BotMessage> {
  const scope = {
    ...createScope(template, data, entry, await emojisFor(entry, template)),
    emojiFallback,
  };
  const { body, images: generated } = render(template, scope);
  const files = await Promise.all(
    generated.map(async (image) => {
      const canvas = createCanvas(image.width, image.height);
      await drawCanvas(canvas.getContext('2d'), image, scope, cachedImage, imageFont);
      return { filename: `${image.id}.png`, data: await canvas.encode('png') };
    }),
  );
  return { ...(body as BotMessage), ...(files.length ? { files } : {}) };
}

/**
 * Renders the admin-edited response for `key`. If the API is down or the saved template
 * cannot be rendered with these values, the catalog default is used instead.
 */
export async function botResponse(key: string, data: TemplateData): Promise<BotMessage> {
  const entry = definition(key);
  if (!entry) throw new Error(`Unknown bot response: ${key}`);
  let template = entry.defaultTemplate;
  try {
    template = (await getBotResponse(key)) as Template;
  } catch (error) {
    console.error(`Failed to load bot response ${key}; using default.`, error);
  }
  try {
    return await build(entry, template, data);
  } catch (error) {
    if (template === entry.defaultTemplate) throw error;
    console.error(`Failed to render bot response ${key}; using default.`, error);
    return build(entry, entry.defaultTemplate, data);
  }
}

/** Common values every response receives. */
export function identityData(identity: { name: string; avatarUrl: string | null }): TemplateData {
  return { userName: identity.name, avatarUrl: identity.avatarUrl ?? '' };
}
