import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { db, eq, schema } from '@futhub/database';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AdminApiConfig } from '../auth/admin-auth.guard.js';
import type { AiSavedConfig, AiSessionInput } from './admin-ai.dto.js';
import type { AiConnection } from './ai-provider.types.js';

type StoredConfig = Readonly<{
  provider: AiConnection['provider'];
  baseUrl: string;
  encryptedApiKey: string;
  models: string[];
  model: string | null;
}>;

export type LoadedAiConfig = Readonly<{
  connection: AiConnection;
  saved: AiSavedConfig;
}>;

const algorithm = 'aes-256-gcm';

function cipherKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function encrypt(secret: string, value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, cipherKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

function decrypt(secret: string, value: string): string {
  const [iv, tag, encrypted, extra] = value.split('.');
  if (!iv || !tag || !encrypted || extra)
    throw new BadRequestException('Configuração de IA inválida. Informe a chave novamente.');
  const decipher = createDecipheriv(algorithm, cipherKey(secret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function saved(row: StoredConfig): AiSavedConfig {
  return {
    provider: row.provider,
    baseUrl: row.baseUrl,
    apiKeyConfigured: true,
    models: row.models,
    model: row.model,
  };
}

@Injectable()
export class AiConfigService {
  constructor(@Inject(AdminApiConfig) private readonly admin: AdminApiConfig) {}

  async get(owner: string): Promise<AiSavedConfig | null> {
    const [row] = await db
      .select({
        provider: schema.adminAiConfigs.provider,
        baseUrl: schema.adminAiConfigs.baseUrl,
        encryptedApiKey: schema.adminAiConfigs.encryptedApiKey,
        models: schema.adminAiConfigs.models,
        model: schema.adminAiConfigs.model,
      })
      .from(schema.adminAiConfigs)
      .where(eq(schema.adminAiConfigs.owner, owner));
    if (!row) return null;
    return saved({ ...row, provider: canonicalAiProvider(row.provider, row.baseUrl) });
  }

  async load(owner: string): Promise<LoadedAiConfig> {
    const stored = await this.stored(owner);
    if (!stored)
      throw new BadRequestException('Configure um provedor de IA antes de iniciar o assistente.');
    return {
      connection: {
        provider: stored.provider,
        baseUrl: stored.baseUrl,
        apiKey: decrypt(this.admin.token, stored.encryptedApiKey),
      },
      saved: saved(stored),
    };
  }

  async resolve(owner: string, input: AiSessionInput): Promise<AiConnection> {
    const inputProvider = canonicalAiProvider(input.provider, input.baseUrl);
    const apiKey = input.apiKey?.trim();
    if (apiKey) return { provider: inputProvider, baseUrl: input.baseUrl, apiKey };
    const stored = await this.stored(owner);
    if (!stored)
      throw new BadRequestException('Informe a chave da API para salvar a primeira configuração.');
    if (stored.provider !== inputProvider || stored.baseUrl !== input.baseUrl)
      throw new BadRequestException('Informe a chave da API para alterar o provedor ou URL base.');
    return {
      provider: stored.provider,
      baseUrl: stored.baseUrl,
      apiKey: decrypt(this.admin.token, stored.encryptedApiKey),
    };
  }

  async save(owner: string, connection: AiConnection, models: string[]): Promise<void> {
    const current = await this.stored(owner);
    const model =
      current?.provider === connection.provider && current.baseUrl === connection.baseUrl
        ? current.model
        : null;
    const value = {
      owner,
      provider: connection.provider,
      baseUrl: connection.baseUrl,
      encryptedApiKey: encrypt(this.admin.token, connection.apiKey),
      models,
      model,
      updatedAt: new Date(),
    };
    await db.insert(schema.adminAiConfigs).values(value).onConflictDoUpdate({
      target: schema.adminAiConfigs.owner,
      set: value,
    });
  }

  async saveModel(owner: string, model: string): Promise<void> {
    await db
      .update(schema.adminAiConfigs)
      .set({ model, updatedAt: new Date() })
      .where(eq(schema.adminAiConfigs.owner, owner));
  }

  private async stored(owner: string): Promise<StoredConfig | null> {
    const [row] = await db
      .select({
        provider: schema.adminAiConfigs.provider,
        baseUrl: schema.adminAiConfigs.baseUrl,
        encryptedApiKey: schema.adminAiConfigs.encryptedApiKey,
        models: schema.adminAiConfigs.models,
        model: schema.adminAiConfigs.model,
      })
      .from(schema.adminAiConfigs)
      .where(eq(schema.adminAiConfigs.owner, owner));
    if (!row) return null;
    return { ...row, provider: canonicalAiProvider(row.provider, row.baseUrl) };
  }
}

export function canonicalAiProvider(value: string, baseUrl: string): AiConnection['provider'] {
  if (value === 'openai' && isOpenCodeGoBaseUrl(baseUrl)) return 'opencode-go';
  if (value === 'openai' || value === 'opencode-go' || value === 'anthropic') return value;
  throw new BadRequestException('Configuração de IA inválida. Salve novamente.');
}

function isOpenCodeGoBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === 'https://opencode.ai' &&
      url.pathname
        .replace(/\/(?:chat\/completions|responses|messages)\/?$/i, '')
        .replace(/\/+$/, '') === '/zen/go/v1'
    );
  } catch {
    return false;
  }
}
