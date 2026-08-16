import type { DiscordIdentityDto, LucroResponse } from '@dreamfut/api-client';
import type {
  Client,
  InteractionReplyOptions,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { Events } from 'discord.js';

export type CommandHandler = Readonly<{
  definition: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(identity: DiscordIdentityDto): Promise<LucroResponse>;
  format(result: LucroResponse, now: Date): string;
}>;

export type CommandHandlers = Readonly<Record<string, CommandHandler>>;

export type DispatchInteraction = Readonly<{
  commandName: string;
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
    const result = await handler.execute({
      id: interaction.user.id,
      name: interaction.user.username,
      avatarUrl: interaction.user.avatarURL(),
    });
    await interaction.reply(handler.format(result, now));
  } catch (error) {
    logger.error(`Failed to execute /${interaction.commandName}.`, error);
    const message = `Não foi possível executar /${interaction.commandName}. Tente novamente.`;
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
