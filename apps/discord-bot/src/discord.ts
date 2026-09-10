import type { DiscordIdentityDto } from '@futhub/api-client';
import type {
  Client,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { Events } from 'discord.js';
import { type Action, type Binding, noMentions, parseAction } from './responses.js';
import type { RuntimeResult } from './runtime.js';

export type CommandOptions = Readonly<{
  getString(name: string, required?: boolean): string | null;
}>;

export class CommandInputError extends Error {}

export type CommandHandler = Readonly<{
  definition: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(
    identity: DiscordIdentityDto,
    options: CommandOptions,
    now: Date,
  ): Promise<string | InteractionReplyOptions | RuntimeResult>;
}>;

export type CommandHandlers = Readonly<Record<string, CommandHandler>>;

export type DispatchInteraction = Readonly<{
  commandName: string;
  options: CommandOptions;
  user: Readonly<{ id: string; username: string; avatarURL(): string | null }>;
  replied: boolean;
  deferred: boolean;
  deferReply(): Promise<unknown>;
  editReply(options: InteractionEditReplyOptions): Promise<unknown>;
  reply(options: string | InteractionReplyOptions): Promise<unknown>;
  followUp(options: InteractionReplyOptions): Promise<unknown>;
}>;

export async function dispatchInteraction(
  interaction: DispatchInteraction,
  handlers: CommandHandlers,
  now: Date,
  logger: Pick<Console, 'error'> = console,
  renderError?: (
    userName: string,
    userId: string,
    commandName: string,
    cause: unknown,
  ) => Promise<InteractionReplyOptions>,
): Promise<void> {
  const handler = handlers[interaction.commandName];
  if (!handler) return;
  try {
    await interaction.deferReply();
    const result = await handler.execute(
      {
        id: interaction.user.id,
        name: interaction.user.username,
        avatarUrl: interaction.user.avatarURL(),
      },
      interaction.options,
      now,
    );
    const message = typeof result === 'object' && 'message' in result ? result.message : result;
    try {
      await interaction.editReply({
        ...(typeof message === 'string' ? { content: message } : message),
        allowedMentions: noMentions,
      } as InteractionEditReplyOptions);
    } catch (error) {
      logger.error('Response delivery failed.', error);
      // Never report a committed mutation as failed, even if Discord rejects its template.
      const content =
        typeof result === 'object' && 'fallback' in result
          ? result.fallback
          : 'Operacao processada. Nao foi possivel exibir a resposta.';
      await interaction.followUp({ content, ephemeral: true, allowedMentions: noMentions });
      return;
    }
    if (typeof result === 'object' && 'followUp' in result && result.followUp) {
      try {
        await interaction.followUp(result.followUp);
      } catch (error) {
        logger.error('Shop controls delivery failed.', error);
      }
    }
  } catch (error) {
    if (!(error instanceof CommandInputError))
      logger.error(`Failed to execute /${interaction.commandName}.`, error);
    const message =
      error instanceof CommandInputError
        ? error.message
        : 'Nao foi possivel confirmar o resultado. Confira seu saldo e inventario antes de repetir.';
    if (interaction.deferred && !interaction.replied)
      await interaction.editReply({
        content: 'Consulte a mensagem privada.',
        allowedMentions: noMentions,
      });
    const response =
      !(error instanceof CommandInputError) && renderError
        ? await renderError(
            interaction.user.username,
            interaction.user.id,
            interaction.commandName,
            error,
          )
        : { content: message };
    if (interaction.replied || interaction.deferred)
      await interaction.followUp({
        ...response,
        flags: Number(response.flags ?? 0) | 64,
        allowedMentions: noMentions,
      });
    else
      await interaction.reply({
        ...response,
        flags: Number(response.flags ?? 0) | 64,
        allowedMentions: noMentions,
      });
  }
}

type Runtime = {
  execute(
    action: Action,
    identity: DiscordIdentityDto,
    binding: Binding,
    now: Date,
  ): Promise<RuntimeResult>;
  error(
    userName: string,
    userId: string,
    commandName: string,
    cause?: unknown,
  ): Promise<InteractionReplyOptions>;
};

// ponytail: process-local replay protection; shared idempotency storage is needed for multiple bot replicas.
const seen = new Set<string>();
const activeEconomy = new Set<string>();
export async function dispatchButton(
  interaction: Omit<DispatchInteraction, 'commandName' | 'options'> & {
    id: string;
    customId: string;
  },
  runtime: Runtime,
  now = new Date(),
): Promise<void> {
  let parsed: ReturnType<typeof parseAction>;
  try {
    parsed = parseAction(interaction.customId, interaction.user.id);
  } catch {
    await interaction.reply({
      content: 'Botao invalido, expirado ou de outro usuario. Execute o comando novamente.',
      ephemeral: true,
      allowedMentions: noMentions,
    });
    return;
  }
  if (seen.has(interaction.id)) return;
  seen.add(interaction.id);
  setTimeout(() => seen.delete(interaction.id), 15 * 60 * 1000).unref();
  const economy = ['lucro.claim', 'pack.purchase', 'pack.open'].includes(parsed.action);
  if (economy && activeEconomy.has(interaction.user.id)) {
    await interaction.reply({
      content: 'Uma operacao ainda esta em andamento. Aguarde a resposta.',
      ephemeral: true,
      allowedMentions: noMentions,
    });
    return;
  }
  if (economy) activeEconomy.add(interaction.user.id);
  try {
    await dispatchInteraction(
      {
        ...interaction,
        user: interaction.user,
        commandName: parsed.action,
        options: { getString: () => null },
        deferReply: () => interaction.deferReply(),
        editReply: (value) => interaction.editReply(value),
        reply: (value) => interaction.reply(value),
        followUp: (value) => interaction.followUp(value),
        get deferred() {
          return interaction.deferred;
        },
        get replied() {
          return interaction.replied;
        },
      },
      {
        [parsed.action]: {
          definition: { name: 'button', description: 'button' },
          execute: (identity) => runtime.execute(parsed.action, identity, parsed.binding, now),
        },
      },
      now,
      console,
      runtime.error,
    );
  } finally {
    if (economy) activeEconomy.delete(interaction.user.id);
  }
}

export function registerDispatch(
  client: Client,
  handlers: CommandHandlers,
  runtime: Runtime,
): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand())
        await dispatchInteraction(interaction, handlers, new Date(), console, runtime.error);
      else if (interaction.isButton()) await dispatchButton(interaction, runtime);
    } catch (error) {
      console.error('Interaction delivery failed.', error);
    }
  });
}
