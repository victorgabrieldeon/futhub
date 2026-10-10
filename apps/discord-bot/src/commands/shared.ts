import {
  type CompletedMissionDto,
  type DiscordIdentityDto,
  configureApiClient,
} from '@futhub/api-client';
import { Command, MessageFlags } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { sendMissionNotice } from '../mission-notice.js';

type CommandResponse = string | Parameters<CommandContext['write']>[0];

export class CommandInputError extends Error {}

/** Command reply followed by a notice for the missions the action completed. */
export class MissionReply {
  constructor(
    readonly response: CommandResponse,
    readonly identity: DiscordIdentityDto,
    readonly missions: readonly CompletedMissionDto[],
  ) {}
}

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

export function cardIds(value: string): readonly string[] {
  const ids = requiredText(value, 'ids')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0)
    throw new CommandInputError('Informe ao menos um ID de carta separado por vírgula.');
  return ids;
}

export abstract class FutHubCommand extends Command {
  protected async respond(
    context: CommandContext,
    commandName: string,
    action: () => Promise<CommandResponse | MissionReply>,
  ): Promise<void> {
    let reply: MissionReply | undefined;
    try {
      refreshApiClient();
      const result = await action();
      if (result instanceof MissionReply) reply = result;
      const response = result instanceof MissionReply ? result.response : result;
      await context.write(typeof response === 'string' ? { content: response } : response);
    } catch (error) {
      if (!(error instanceof CommandInputError))
        console.error(`Failed to execute /${commandName}.`, error);
      await context.write({
        content:
          error instanceof CommandInputError
            ? error.message
            : `Não foi possível executar /${commandName}. Tente novamente.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (reply)
      await sendMissionNotice((notice) => context.followup(notice), reply.identity, reply.missions);
  }
}
