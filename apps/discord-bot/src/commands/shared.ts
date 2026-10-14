import { type DiscordIdentityDto, configureApiClient } from '@futhub/api-client';
import { Command } from 'seyfert';
import type { CommandContext } from 'seyfert';

import type { BotMessage } from '../core/bot-response.js';
import { stageOf } from '../core/juice.js';
import { type ActionReply, deliver } from '../core/replies.js';
import { friendlyError, notice } from '../core/ui.js';

type CommandResponse = string | BotMessage;

/** Erro do jogador (entrada inválida): a mensagem é mostrada como está, sem log. */
export class CommandInputError extends Error {}

export function identity(context: CommandContext): DiscordIdentityDto {
  return {
    id: context.author.id,
    name: context.author.username,
    avatarUrl: context.author.avatarURL(),
  };
}

export function refreshApiClient(): void {
  const baseUrl = process.env.API_BASE_URL;
  const token = process.env.API_INTERNAL_TOKEN;
  if (baseUrl && token) configureApiClient({ baseUrl, token });
}

export function requiredText(value: string, name: string): string {
  const text = value.trim();
  if (!text) throw new CommandInputError(`Informe ${name}.`);
  return text;
}

function isActionReply(value: CommandResponse | ActionReply): value is ActionReply {
  return typeof value === 'object' && 'afterSend' in value;
}

export function commandError(commandName: string, error: unknown): BotMessage {
  if (error instanceof CommandInputError)
    return notice(
      'warning',
      error.message,
      undefined,
      'Use /ajuda para ver como cada comando funciona.',
    ) as BotMessage;
  console.error(`Failed to execute /${commandName}.`, error);
  return notice(
    'error',
    `Não foi possível concluir /${commandName}`,
    friendlyError(error, 'Algo deu errado do nosso lado.'),
    'Tente novamente em instantes.',
  ) as BotMessage;
}

export abstract class FutHubCommand extends Command {
  protected async respond(
    context: CommandContext,
    commandName: string,
    action: () => Promise<CommandResponse | ActionReply>,
  ): Promise<void> {
    let result: CommandResponse | ActionReply;
    try {
      refreshApiClient();
      result = await action();
    } catch (error) {
      await context.write(commandError(commandName, error));
      return;
    }
    if (!isActionReply(result)) {
      await context.write(typeof result === 'string' ? { content: result } : result);
      return;
    }
    try {
      await deliver(stageOf(context), result);
    } catch (error) {
      // A ação já aconteceu na API; só a apresentação falhou.
      console.error(`Failed to present /${commandName}.`, error);
    }
  }
}
