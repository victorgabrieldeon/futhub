import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { BotEmojiDto, BotEmojiListDto } from './bot-emojis.dto.js';

const discordApi = 'https://discord.com/api/v10';
// Discord limits each application to 2000 emojis and each image to 256 KiB.
export const botEmojiLimit = 2000;
const maxImageBytes = 256 * 1024;
const cacheTtlMs = 60_000;
const maxRateLimitRetries = 5;
const signatures: Record<string, (bytes: Buffer) => boolean> = {
  png: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  jpeg: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  gif: (bytes) => /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('latin1')),
  webp: (bytes) =>
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP',
};

type DiscordEmoji = { id: string; name: string; animated?: boolean };

export class BotEmojiLimitException extends BadRequestException {
  constructor() {
    super(`O bot atingiu o limite de ${botEmojiLimit} emojis.`);
  }
}

export function validateBotEmojiImage(image: string): void {
  const match = /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  const bytes = match ? Buffer.from(match[2] ?? '', 'base64') : undefined;
  if (!match || !bytes?.length || !signatures[match[1] ?? '']?.(bytes))
    throw new BadRequestException('Envie uma imagem PNG, JPEG, GIF ou WebP válida.');
  if (bytes.length > maxImageBytes) throw new BadRequestException('A imagem excede 256 KiB.');
}

function toDto(emoji: DiscordEmoji): BotEmojiDto {
  const animated = emoji.animated === true;
  return {
    id: emoji.id,
    name: emoji.name,
    animated,
    imageUrl: `https://cdn.discordapp.com/emojis/${emoji.id}.${animated ? 'gif' : 'png'}`,
  };
}

function snowflake(id: string): string {
  if (!/^\d{17,20}$/.test(id)) throw new NotFoundException('Emoji não encontrado.');
  return id;
}

@Injectable()
export class BotEmojisService {
  private cache: { expiresAt: number; emojis: BotEmojiDto[] } | undefined;

  isConfigured(): boolean {
    return Boolean(process.env.DISCORD_TOKEN?.trim() && process.env.DISCORD_CLIENT_ID?.trim());
  }

  private config(): { token: string; applicationId: string } {
    const token = process.env.DISCORD_TOKEN?.trim();
    const applicationId = process.env.DISCORD_CLIENT_ID?.trim();
    if (!token || !applicationId)
      throw new ServiceUnavailableException(
        'Configure DISCORD_TOKEN e DISCORD_CLIENT_ID na API para gerenciar emojis do bot.',
      );
    return { token, applicationId };
  }

  private async discord<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { token, applicationId } = this.config();
    let response: Response;
    for (let attempt = 0; ; attempt += 1) {
      try {
        response = await fetch(`${discordApi}/applications/${applicationId}/emojis${path}`, {
          ...init,
          headers: { authorization: `Bot ${token}`, 'content-type': 'application/json' },
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new BadGatewayException('Não foi possível conectar ao Discord.');
      }
      if (response.status !== 429 || attempt >= maxRateLimitRetries) break;
      // Criar emojis em lote (retroativo de times, coleções e packs) esbarra no rate limit.
      const { retry_after: retryAfter } = (await response.json().catch(() => ({}))) as {
        retry_after?: unknown;
      };
      const seconds = typeof retryAfter === 'number' && retryAfter > 0 ? retryAfter : 1;
      await new Promise((resolve) => setTimeout(resolve, Math.min(seconds, 60) * 1_000));
    }
    if (response.status === 204) return undefined as T;
    const body = (await response.json().catch(() => null)) as
      | { code?: unknown; message?: unknown }
      | T
      | null;
    if (response.ok) return body as T;
    const error = (body ?? {}) as { code?: unknown; message?: unknown };
    if (response.status === 404) throw new NotFoundException('Emoji não encontrado.');
    if (error.code === 30008) throw new BotEmojiLimitException();
    if (response.status === 400)
      throw new BadRequestException(
        `Discord recusou o emoji${typeof error.message === 'string' ? `: ${error.message}` : '.'}`,
      );
    throw new BadGatewayException(`Discord respondeu com status ${response.status}.`);
  }

  private async fetchAll(): Promise<BotEmojiDto[]> {
    const { items } = await this.discord<{ items: DiscordEmoji[] }>('');
    const emojis = items.map(toDto).sort((a, b) => a.name.localeCompare(b.name));
    this.cache = { expiresAt: Date.now() + cacheTtlMs, emojis };
    return structuredClone(emojis);
  }

  /** Admin always reads Discord, the source of truth; the bot tolerates a short-lived cache. */
  async list(fresh = true): Promise<BotEmojiListDto> {
    const emojis =
      !fresh && this.cache && this.cache.expiresAt > Date.now()
        ? structuredClone(this.cache.emojis)
        : await this.fetchAll();
    return { limit: botEmojiLimit, emojis };
  }

  async create(name: string, image: string): Promise<BotEmojiDto> {
    validateBotEmojiImage(image);
    const { emojis } = await this.list();
    if (emojis.some((emoji) => emoji.name.toLowerCase() === name.toLowerCase()))
      throw new ConflictException(`Já existe um emoji chamado ${name}.`);
    return this.upload(name, image);
  }

  /** Sobe o emoji sem conferir nomes; quem chama garante a unicidade. */
  async upload(name: string, image: string): Promise<BotEmojiDto> {
    validateBotEmojiImage(image);
    const created = await this.discord<DiscordEmoji>('', {
      method: 'POST',
      body: JSON.stringify({ name, image }),
    });
    this.cache = undefined;
    return toDto(created);
  }

  async rename(id: string, name: string): Promise<BotEmojiDto> {
    snowflake(id);
    const { emojis } = await this.list();
    if (emojis.some((emoji) => emoji.id !== id && emoji.name.toLowerCase() === name.toLowerCase()))
      throw new ConflictException(`Já existe um emoji chamado ${name}.`);
    const updated = await this.discord<DiscordEmoji>(`/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    this.cache = undefined;
    return toDto(updated);
  }

  async remove(id: string): Promise<void> {
    await this.discord<void>(`/${snowflake(id)}`, { method: 'DELETE' });
    this.cache = undefined;
  }
}
