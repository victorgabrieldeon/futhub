import { advanceMissions } from '../../missions/missions.service.js';
import { grantCommandXp } from '../../progression/progression.js';
import { upsertDiscordUser } from '../../users/user.repository.js';
import {
  lucroCommand,
  lucroDefaultRewards,
  rewardLocaleFor,
  type CommandConfig,
  type CommandTransaction,
  type DiscordIdentity,
  type ResgatarLucroRepository,
} from '../use-cases/resgatar-lucro/resgatar-lucro.types.js';

type Database = typeof import('@futhub/database');
type DatabaseLoader = () => Promise<Database>;

export class DrizzleResgatarLucroRepository implements ResgatarLucroRepository {
  constructor(private readonly loadDatabase: DatabaseLoader) {}

  async run<T>(
    command: CommandConfig,
    identity: DiscordIdentity,
    now: Date,
    operation: (transaction: CommandTransaction, persistedCommand: CommandConfig) => Promise<T>,
  ): Promise<T> {
    const database = await this.loadDatabase();
    const { and, db, eq, schema, sql } = database;
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${command.name}:${identity.id}`}))`,
      );
      const user = await upsertDiscordUser(tx, schema, identity, now);
      const rewardLocale = rewardLocaleFor(user.language);

      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`command-default:${command.name}`}))`,
      );
      const [insertedConfig] = await tx
        .insert(schema.commandConfigs)
        .values({
          commandName: command.name,
          cooldownSeconds: command.cooldownSeconds,
          embedTitle: command.embed.title,
          embedDescription: command.embed.description,
          embedColor: command.embed.color,
          embedFooter: command.embed.footer,
        })
        .onConflictDoNothing({ target: schema.commandConfigs.commandName })
        .returning({
          id: schema.commandConfigs.id,
          cooldownSeconds: schema.commandConfigs.cooldownSeconds,
          embedTitle: schema.commandConfigs.embedTitle,
          embedDescription: schema.commandConfigs.embedDescription,
          embedColor: schema.commandConfigs.embedColor,
          embedFooter: schema.commandConfigs.embedFooter,
        });
      const config =
        insertedConfig ??
        (await tx.query.commandConfigs.findFirst({
          columns: {
            id: true,
            cooldownSeconds: true,
            embedTitle: true,
            embedDescription: true,
            embedColor: true,
            embedFooter: true,
          },
          where: eq(schema.commandConfigs.commandName, command.name),
        }));
      if (!config) throw new Error(`Failed to load ${command.name} configuration.`);
      if (insertedConfig) {
        const localizedRewards =
          command === lucroCommand
            ? lucroDefaultRewards
            : command.rewards.map((reward) => ({
                ...reward,
                messages: { pt: reward.message, es: reward.message, en: reward.message },
              }));
        const texts = await tx
          .insert(schema.localizedTexts)
          .values(localizedRewards.map(() => ({})))
          .returning({ id: schema.localizedTexts.id });
        if (texts.length !== localizedRewards.length)
          throw new Error('Failed to create reward messages.');
        const rewardTexts = localizedRewards.map((reward, index) => {
          const text = texts[index];
          if (!text) throw new Error('Failed to create reward message.');
          return { reward, text };
        });
        await tx.insert(schema.localizedTextTranslations).values(
          rewardTexts.flatMap(({ reward, text }) =>
            Object.entries(reward.messages).map(([locale, content]) => ({
              localizedTextId: text.id,
              locale,
              content,
            })),
          ),
        );
        await tx.insert(schema.commandRewards).values(
          rewardTexts.map(({ reward, text }) => ({
            commandConfigId: config.id,
            value: reward.value,
            weight: reward.weight,
            messageTextId: text.id,
          })),
        );
      }
      const rewardRows = await tx.query.commandRewards.findMany({
        columns: { value: true, weight: true, messageTextId: true },
        where: eq(schema.commandRewards.commandConfigId, config.id),
      });
      const translations = rewardRows.length
        ? await tx.query.localizedTextTranslations.findMany({
            columns: { localizedTextId: true, locale: true, content: true },
            where: database.inArray(
              schema.localizedTextTranslations.localizedTextId,
              rewardRows.map((reward) => reward.messageTextId),
            ),
          })
        : [];
      const messagesByTextId = new Map<
        string,
        Partial<Record<'pt' | typeof rewardLocale, string>>
      >();
      for (const translation of translations) {
        if (translation.locale !== 'pt' && translation.locale !== rewardLocale) continue;
        const messages = messagesByTextId.get(translation.localizedTextId) ?? {};
        messages[translation.locale as 'pt' | typeof rewardLocale] = translation.content;
        messagesByTextId.set(translation.localizedTextId, messages);
      }
      const rewards = rewardRows.map((reward) => {
        const messages = messagesByTextId.get(reward.messageTextId);
        const message = messages?.[rewardLocale] ?? messages?.pt;
        if (!message) throw new Error(`Reward ${reward.messageTextId} has no message.`);
        return { value: reward.value, weight: reward.weight, message };
      });
      if (rewards.length === 0) throw new Error(`Command ${command.name} has no rewards.`);
      const persistedCommand = {
        ...command,
        cooldownSeconds: config.cooldownSeconds,
        rewards,
        embed: {
          title: config.embedTitle,
          description: config.embedDescription,
          color: config.embedColor,
          footer: config.embedFooter,
        },
      };

      return operation(
        {
          getAvailableAt: async () => {
            const cooldown = await tx.query.userCooldowns.findFirst({
              columns: { availableAt: true },
              where: and(
                eq(schema.userCooldowns.userId, user.id),
                eq(schema.userCooldowns.commandConfigId, config.id),
              ),
            });
            return cooldown?.availableAt ?? null;
          },
          credit: async (value) => {
            if (!persistedCommand.rewards.some((reward) => reward.value === value))
              throw new Error('Unknown reward.');
            const [credited] = await tx
              .update(schema.users)
              .set({ saldo: sql`${schema.users.saldo} + ${value}`, atualizadoEm: now })
              .where(eq(schema.users.id, user.id))
              .returning({ balance: schema.users.saldo });
            if (!credited) throw new Error('Failed to credit user.');
            return credited.balance;
          },
          grantProgression: () => grantCommandXp(database, tx, user.id, 'lucro', now),
          advanceMission: () => advanceMissions(database, tx, user.id, 'claim_profit', now),
          setAvailableAt: async (availableAt) => {
            await tx
              .insert(schema.userCooldowns)
              .values({
                userId: user.id,
                commandConfigId: config.id,
                availableAt,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: [schema.userCooldowns.userId, schema.userCooldowns.commandConfigId],
                set: { availableAt, updatedAt: now },
              });
          },
        },
        persistedCommand,
      );
    });
  }
}
