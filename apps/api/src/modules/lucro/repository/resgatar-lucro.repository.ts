import { advanceMissions } from '../../missions/missions.service.js';
import { grantCommandXp } from '../../progression/progression.js';
import { upsertDiscordUser } from '../../users/user.repository.js';
import type {
  CommandConfig,
  CommandTransaction,
  DiscordIdentity,
  ResgatarLucroRepository,
} from '../use-cases/resgatar-lucro/resgatar-lucro.types.js';
import { lucroCommand } from '../use-cases/resgatar-lucro/resgatar-lucro.types.js';

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

      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`command-default:${command.name}`}))`,
      );
      const [insertedConfig] = await tx
        .insert(schema.commandConfigs)
        .values({
          commandName: command.name,
          cooldownSeconds: command.cooldownSeconds,
          embed: command.embed ?? lucroCommand.embed!,
        })
        .onConflictDoNothing({ target: schema.commandConfigs.commandName })
        .returning({
          id: schema.commandConfigs.id,
          cooldownSeconds: schema.commandConfigs.cooldownSeconds,
          embed: schema.commandConfigs.embed,
        });
      const config =
        insertedConfig ??
        (await tx.query.commandConfigs.findFirst({
          columns: { id: true, cooldownSeconds: true, embed: true },
          where: eq(schema.commandConfigs.commandName, command.name),
        }));
      if (!config) throw new Error(`Failed to load ${command.name} configuration.`);
      if (insertedConfig)
        await tx.insert(schema.commandRewards).values(
          command.rewards.map((reward) => ({
            ...reward,
            commandConfigId: config.id,
            messages: { pt: reward.message, es: reward.message, en: reward.message },
          })),
        );
      const rewards = await tx.query.commandRewards.findMany({
        columns: { value: true, weight: true, message: true, messages: true },
        where: eq(schema.commandRewards.commandConfigId, config.id),
      });
      if (rewards.length === 0) throw new Error(`Command ${command.name} has no rewards.`);
      const locale = user.language.startsWith('es')
        ? 'es'
        : user.language.startsWith('en')
          ? 'en'
          : 'pt';
      const persistedCommand = {
        ...command,
        cooldownSeconds: config.cooldownSeconds,
        embed: config.embed,
        rewards: rewards.map((reward) => ({
          value: reward.value,
          weight: reward.weight,
          message: reward.messages[locale] || reward.message,
        })),
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
