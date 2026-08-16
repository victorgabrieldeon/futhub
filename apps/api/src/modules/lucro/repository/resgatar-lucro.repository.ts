import { Injectable } from '@nestjs/common';

import type {
  CommandConfig,
  CommandTransaction,
  DiscordIdentity,
} from '../use-cases/resgatar-lucro/resgatar-lucro.types.js';

export abstract class ResgatarLucroRepository {
  abstract run<T>(
    command: CommandConfig,
    identity: DiscordIdentity,
    now: Date,
    operation: (transaction: CommandTransaction, persistedCommand: CommandConfig) => Promise<T>,
  ): Promise<T>;
}

@Injectable()
export class DatabaseConfig {
  constructor(readonly url: string) {}

  static fromEnvironment(): DatabaseConfig {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required.');
    return new DatabaseConfig(url);
  }
}

@Injectable()
export class DrizzleResgatarLucroRepository implements ResgatarLucroRepository {
  async run<T>(
    command: CommandConfig,
    identity: DiscordIdentity,
    now: Date,
    operation: (transaction: CommandTransaction, persistedCommand: CommandConfig) => Promise<T>,
  ): Promise<T> {
    const { and, db, eq, schema, sql } = await import('@dreamfut/database');
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${command.name}:${identity.id}`}))`,
      );
      const [user] = await tx
        .insert(schema.users)
        .values({ discordUserId: identity.id, nome: identity.name, urlAvatar: identity.avatarUrl })
        .onConflictDoUpdate({
          target: schema.users.discordUserId,
          set: { nome: identity.name, urlAvatar: identity.avatarUrl, atualizadoEm: now },
        })
        .returning({ id: schema.users.id });
      if (!user) throw new Error('Failed to load user.');

      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`command-default:${command.name}`}))`,
      );
      const [insertedConfig] = await tx
        .insert(schema.commandConfigs)
        .values({ commandName: command.name, cooldownSeconds: command.cooldownSeconds })
        .onConflictDoNothing({ target: schema.commandConfigs.commandName })
        .returning({
          id: schema.commandConfigs.id,
          cooldownSeconds: schema.commandConfigs.cooldownSeconds,
        });
      const config =
        insertedConfig ??
        (await tx.query.commandConfigs.findFirst({
          columns: { id: true, cooldownSeconds: true },
          where: eq(schema.commandConfigs.commandName, command.name),
        }));
      if (!config) throw new Error(`Failed to load ${command.name} configuration.`);
      if (insertedConfig)
        await tx
          .insert(schema.commandRewards)
          .values(command.rewards.map((reward) => ({ ...reward, commandConfigId: config.id })));
      const rewards = await tx.query.commandRewards.findMany({
        columns: { value: true, weight: true, message: true },
        where: eq(schema.commandRewards.commandConfigId, config.id),
      });
      if (rewards.length === 0) throw new Error(`Command ${command.name} has no rewards.`);
      const persistedCommand = { ...command, cooldownSeconds: config.cooldownSeconds, rewards };

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
