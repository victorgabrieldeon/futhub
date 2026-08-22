import type { DiscordIdentityDto } from '@futhub/api-client';
import type {
  Client,
  InteractionReplyOptions,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { Events } from 'discord.js';

export type CommandOptions = Readonly<{
  getString(name: string, required?: boolean): string | null;
}>;

export class CommandInputError extends Error {}

export type CommandHandler = Readonly<{
  definition: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(identity: DiscordIdentityDto, options: CommandOptions, now: Date): Promise<string>;
}>;

export type CommandHandlers = Readonly<Record<string, CommandHandler>>;

export type DispatchInteraction = Readonly<{
  commandName: string;
  options: CommandOptions;
  user: Readonly<{ id: string; username: string; avatarURL(): string | null }>;
  replied: boolean;
  deferred: boolean;
  reply(options: string | InteractionReplyOptions): Promise<unknown>;
  followUp(options: InteractionReplyOptions): Promise<unknown>;
}>;

export async function dispatchInteraction(
  interaction: DispatchInteraction,
  handlers: CommandHandlers,
  now: Date,
  logger: Pick<Console, 'error'> = console,
): Promise<void> {
  const handler = handlers[interaction.commandName];
  if (!handler) return;
  try {
    const message = await handler.execute(
      {
        id: interaction.user.id,
        name: interaction.user.username,
        avatarUrl: interaction.user.avatarURL(),
      },
      interaction.options,
      now,
    );
    await interaction.reply(message);
  } catch (error) {
    if (!(error instanceof CommandInputError))
      logger.error(`Failed to execute /${interaction.commandName}.`, error);
    const message =
      error instanceof CommandInputError
        ? error.message
        : `Não foi possível executar /${interaction.commandName}. Tente novamente.`;
    if (interaction.replied || interaction.deferred)
      await interaction.followUp({ content: message, ephemeral: true });
    else await interaction.reply({ content: message, ephemeral: true });
  }
}

export function registerDispatch(client: Client, handlers: CommandHandlers): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand())
      await dispatchInteraction(interaction, handlers, new Date());
  });
}
