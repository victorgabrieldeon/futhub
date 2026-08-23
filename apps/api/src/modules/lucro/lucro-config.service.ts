import type * as DatabaseModule from '@futhub/database';
import { Injectable } from '@nestjs/common';

import type {
  AdminLucroConfigResponse,
  AdminLucroRewardDto,
  UpdateLucroConfigRequest,
} from './lucro.dto.js';
import {
  lucroCommand,
  lucroDefaultRewards,
  rewardLocales,
  type LocalizedReward,
  type RewardLocale,
} from './use-cases/resgatar-lucro/resgatar-lucro.types.js';

type Database = typeof DatabaseModule;
type Transaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

@Injectable()
export class LucroConfigService {
  async get(): Promise<AdminLucroConfigResponse> {
    // Database module reads DATABASE_URL during evaluation; E2E sets it after app import.
    const database = await import('@futhub/database');
    return database.db.transaction(async (transaction) => {
      const config = await this.ensureConfig(database, transaction);
      return {
        cooldownSeconds: config.cooldownSeconds,
        rewards: await this.getRewards(database, transaction, config.id),
        embed: {
          title: config.embedTitle,
          description: config.embedDescription,
          color: config.embedColor,
          footer: config.embedFooter,
        },
      };
    });
  }

  async replace(request: UpdateLucroConfigRequest): Promise<AdminLucroConfigResponse> {
    // Database module reads DATABASE_URL during evaluation; E2E sets it after app import.
    const database = await import('@futhub/database');
    return database.db.transaction(async (transaction) => {
      const config = await this.ensureConfig(database, transaction);
      const previousRewards = await transaction.query.commandRewards.findMany({
        columns: { messageTextId: true },
        where: database.eq(database.schema.commandRewards.commandConfigId, config.id),
      });
      await transaction
        .update(database.schema.commandConfigs)
        .set({
          cooldownSeconds: request.cooldownSeconds,
          embedTitle: request.embed.title,
          embedDescription: request.embed.description,
          embedColor: request.embed.color,
          embedFooter: request.embed.footer,
          updatedAt: new Date(),
        })
        .where(database.eq(database.schema.commandConfigs.id, config.id));
      await transaction
        .delete(database.schema.commandRewards)
        .where(database.eq(database.schema.commandRewards.commandConfigId, config.id));
      if (previousRewards.length)
        await transaction.delete(database.schema.localizedTexts).where(
          database.inArray(
            database.schema.localizedTexts.id,
            previousRewards.map((reward) => reward.messageTextId),
          ),
        );
      const rewards = await this.insertRewards(database, transaction, config.id, request.rewards);
      return { cooldownSeconds: request.cooldownSeconds, rewards, embed: request.embed };
    });
  }

  private async getRewards(
    database: Database,
    transaction: Transaction,
    commandConfigId: string,
  ): Promise<AdminLucroRewardDto[]> {
    const rewards = await transaction.query.commandRewards.findMany({
      columns: { id: true, value: true, weight: true, messageTextId: true },
      where: database.eq(database.schema.commandRewards.commandConfigId, commandConfigId),
    });
    const translations = rewards.length
      ? await transaction.query.localizedTextTranslations.findMany({
          columns: { localizedTextId: true, locale: true, content: true },
          where: database.inArray(
            database.schema.localizedTextTranslations.localizedTextId,
            rewards.map((reward) => reward.messageTextId),
          ),
        })
      : [];
    const messagesByTextId = new Map<string, Partial<Record<RewardLocale, string>>>();
    for (const translation of translations) {
      const locale = translation.locale as RewardLocale;
      if (!rewardLocales.includes(locale)) continue;
      const messages = messagesByTextId.get(translation.localizedTextId) ?? {};
      messages[locale] = translation.content;
      messagesByTextId.set(translation.localizedTextId, messages);
    }
    return rewards.map((reward) => {
      const messages = messagesByTextId.get(reward.messageTextId) ?? {};
      const pt = messages.pt ?? '';
      return {
        id: reward.id,
        value: reward.value,
        weight: reward.weight,
        messages: { pt, es: messages.es ?? pt, en: messages.en ?? pt },
      };
    });
  }

  private async insertRewards(
    database: Database,
    transaction: Transaction,
    commandConfigId: string,
    rewards: readonly LocalizedReward[],
  ): Promise<AdminLucroRewardDto[]> {
    const texts = await transaction
      .insert(database.schema.localizedTexts)
      .values(rewards.map(() => ({})))
      .returning({ id: database.schema.localizedTexts.id });
    if (texts.length !== rewards.length) throw new Error('Failed to create reward messages.');
    const rewardTexts = rewards.map((reward, index) => {
      const text = texts[index];
      if (!text) throw new Error('Failed to create reward message.');
      return { reward, text };
    });
    await transaction.insert(database.schema.localizedTextTranslations).values(
      rewardTexts.flatMap(({ reward, text }) =>
        rewardLocales.map((locale) => ({
          localizedTextId: text.id,
          locale,
          content: reward.messages[locale],
        })),
      ),
    );
    await transaction.insert(database.schema.commandRewards).values(
      rewardTexts.map(({ reward, text }) => ({
        commandConfigId,
        value: reward.value,
        weight: reward.weight,
        messageTextId: text.id,
      })),
    );
    return this.getRewards(database, transaction, commandConfigId);
  }

  private async ensureConfig(
    database: Database,
    transaction: Transaction,
  ): Promise<{
    id: string;
    cooldownSeconds: number;
    embedTitle: string;
    embedDescription: string;
    embedColor: string;
    embedFooter: string;
  }> {
    await transaction.execute(
      database.sql`select pg_advisory_xact_lock(hashtext(${`command-default:${lucroCommand.name}`}))`,
    );
    const [created] = await transaction
      .insert(database.schema.commandConfigs)
      .values({
        commandName: lucroCommand.name,
        cooldownSeconds: lucroCommand.cooldownSeconds,
        embedTitle: lucroCommand.embed.title,
        embedDescription: lucroCommand.embed.description,
        embedColor: lucroCommand.embed.color,
        embedFooter: lucroCommand.embed.footer,
      })
      .onConflictDoNothing({ target: database.schema.commandConfigs.commandName })
      .returning({
        id: database.schema.commandConfigs.id,
        cooldownSeconds: database.schema.commandConfigs.cooldownSeconds,
        embedTitle: database.schema.commandConfigs.embedTitle,
        embedDescription: database.schema.commandConfigs.embedDescription,
        embedColor: database.schema.commandConfigs.embedColor,
        embedFooter: database.schema.commandConfigs.embedFooter,
      });
    const config =
      created ??
      (await transaction.query.commandConfigs.findFirst({
        columns: {
          id: true,
          cooldownSeconds: true,
          embedTitle: true,
          embedDescription: true,
          embedColor: true,
          embedFooter: true,
        },
        where: database.eq(database.schema.commandConfigs.commandName, lucroCommand.name),
      }));
    if (!config) throw new Error('Failed to load lucro configuration.');
    if (created) await this.insertRewards(database, transaction, config.id, lucroDefaultRewards);
    return config;
  }
}
