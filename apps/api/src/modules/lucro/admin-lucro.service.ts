import { BadRequestException, Injectable } from '@nestjs/common';

import type {
  LucroConfigDto,
  LucroConfigInputDto,
  LucroEmbedDto,
  LucroEmbedSchemaDto,
} from './admin-lucro.dto.js';
import { lucroCommand } from './use-cases/resgatar-lucro/resgatar-lucro.types.js';

type Database = typeof import('@futhub/database');
type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

const defaultEmbed: LucroEmbedDto = {
  title: '/lucro',
  description:
    '**{message}**\nSaldo: **{balance}**\nXP: **+{xp}** ({xp}/{nextLevelXp})\nNível: **{level}**',
  color: '#2B2D31',
  footer: 'Próximo lucro: {availableAt}',
};

const defaultRewardMessages = [
  { pt: 'Lucro básico: +50', es: 'Ganancia básica: +50', en: 'Basic profit: +50' },
  { pt: 'Bom lucro: +100', es: 'Buena ganancia: +100', en: 'Good profit: +100' },
  { pt: 'Grande lucro: +250', es: 'Gran ganancia: +250', en: 'Big profit: +250' },
  { pt: 'Lucro raro: +500', es: 'Ganancia rara: +500', en: 'Rare profit: +500' },
  { pt: 'Lucro lendário: +1000', es: 'Ganancia legendaria: +1000', en: 'Legendary profit: +1000' },
] as const;

const embedSchema: LucroEmbedSchemaDto = {
  description: 'Mensagem exibida pelo Discord após resgate bem-sucedido.',
  variables: [
    { token: '{message}', description: 'Mensagem da recompensa', example: 'Lucro raro: +500' },
    { token: '{reward}', description: 'Valor da recompensa', example: '500' },
    { token: '{balance}', description: 'Saldo atual', example: '4250' },
    { token: '{xp}', description: 'XP ganho', example: '10' },
    { token: '{nextLevelXp}', description: 'XP do próximo nível', example: '100' },
    { token: '{level}', description: 'Nível atual', example: '12' },
    { token: '{availableAt}', description: 'Próximo resgate', example: 'amanhã às 12:00' },
  ],
  properties: {
    title: { maxLength: 256, examples: ['/lucro'] },
    description: { maxLength: 4000, examples: [defaultEmbed.description] },
    color: { maxLength: 7, examples: ['#2B2D31'] },
    footer: { maxLength: 2048, examples: [defaultEmbed.footer] },
  },
};

@Injectable()
export class AdminLucroService {
  async get(): Promise<LucroConfigDto> {
    const database = await this.database();
    return database.db.transaction((tx) => this.config(database, tx));
  }

  async update(input: LucroConfigInputDto): Promise<LucroConfigDto> {
    this.validate(input);
    const database = await this.database();
    return database.db.transaction(async (tx) => {
      const config = await this.ensure(database, tx);
      await tx
        .update(database.schema.commandConfigs)
        .set({ cooldownSeconds: input.cooldownSeconds, embed: input.embed, updatedAt: new Date() })
        .where(database.eq(database.schema.commandConfigs.id, config.id));
      await tx
        .delete(database.schema.commandRewards)
        .where(database.eq(database.schema.commandRewards.commandConfigId, config.id));
      await tx.insert(database.schema.commandRewards).values(
        input.rewards.map((reward) => ({
          commandConfigId: config.id,
          value: reward.value,
          weight: reward.weight,
          message: reward.messages.pt,
          messages: reward.messages,
        })),
      );
      return this.config(database, tx);
    });
  }

  schema(): LucroEmbedSchemaDto {
    return embedSchema;
  }

  private async config(database: Database, tx: Transaction): Promise<LucroConfigDto> {
    const config = await this.ensure(database, tx);
    const rewards = await tx.query.commandRewards.findMany({
      where: database.eq(database.schema.commandRewards.commandConfigId, config.id),
      orderBy: (rewards, { asc }) => [asc(rewards.value)],
    });
    return {
      cooldownSeconds: config.cooldownSeconds,
      embed: config.embed,
      rewards: rewards.map((reward) => ({
        id: reward.id,
        value: reward.value,
        weight: reward.weight,
        messages: reward.messages,
      })),
    };
  }

  private async ensure(
    database: Database,
    tx: Transaction,
  ): Promise<{ id: string; cooldownSeconds: number; embed: LucroEmbedDto }> {
    await tx.execute(database.sql`select pg_advisory_xact_lock(hashtext('command-config:lucro'))`);
    await tx
      .insert(database.schema.commandConfigs)
      .values({
        commandName: lucroCommand.name,
        cooldownSeconds: lucroCommand.cooldownSeconds,
        embed: defaultEmbed,
      })
      .onConflictDoNothing({ target: database.schema.commandConfigs.commandName });
    const config = await tx.query.commandConfigs.findFirst({
      columns: { id: true, cooldownSeconds: true, embed: true },
      where: database.eq(database.schema.commandConfigs.commandName, lucroCommand.name),
    });
    if (!config) throw new Error('Failed to load lucro configuration.');
    const rewards = await tx.query.commandRewards.findMany({
      columns: { id: true },
      where: database.eq(database.schema.commandRewards.commandConfigId, config.id),
      limit: 1,
    });
    if (rewards.length === 0)
      await tx.insert(database.schema.commandRewards).values(
        lucroCommand.rewards.map((reward, index) => ({
          commandConfigId: config.id,
          value: reward.value,
          weight: reward.weight,
          message: reward.message,
          messages: defaultRewardMessages[index] ?? {
            pt: reward.message,
            es: reward.message,
            en: reward.message,
          },
        })),
      );
    return config;
  }

  private validate(input: LucroConfigInputDto): void {
    if (!Number.isInteger(input.cooldownSeconds) || input.cooldownSeconds < 1)
      throw new BadRequestException('Cooldown must be a positive integer.');
    if (!input.rewards.length) throw new BadRequestException('At least one reward is required.');
    for (const reward of input.rewards) {
      if (!Number.isInteger(reward.value) || reward.value < 1)
        throw new BadRequestException('Reward value must be a positive integer.');
      if (!Number.isInteger(reward.weight) || reward.weight < 1)
        throw new BadRequestException('Reward weight must be a positive integer.');
      if (Object.values(reward.messages).some((message) => !message.trim() || message.length > 280))
        throw new BadRequestException('Reward messages must contain at most 280 characters.');
    }
    if (
      !input.embed.title.trim() ||
      !input.embed.description.trim() ||
      !/^#[0-9A-Fa-f]{6}$/.test(input.embed.color) ||
      input.embed.title.length > 256 ||
      input.embed.description.length > 4_000 ||
      input.embed.footer.length > 2_048
    )
      throw new BadRequestException('Invalid Discord embed.');
  }

  private database(): Promise<Database> {
    return import('@futhub/database');
  }
}
