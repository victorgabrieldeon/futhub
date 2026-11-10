import { ApiClientError, simulateTestMatch } from '@futhub/api-client';
import { Declare, Options, createIntegerOption, createUserOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { type TestMatch, matchFrames, testMatchResponse } from '../features/test-match.js';
import { CommandInputError, FutHubCommand, identity } from './shared.js';

const options = {
  adversario: createUserOption({
    description: 'Jogador para enfrentar. Sem adversário, joga contra a CPU.',
    required: false,
  }),
  seed: createIntegerOption({
    description: 'Seed para repetir uma partida.',
    required: false,
    min_value: 1,
    max_value: 2_147_483_647,
  }),
};

@Declare({
  name: 'partida-teste',
  description: 'Simule um amistoso ao vivo sem afetar a liga.',
})
@Options(options)
export default class PartidaTesteCommand extends FutHubCommand {
  /** Pause between narrated events. */
  static frameDelayMs = 1_500;

  async run(context: CommandContext<typeof options>): Promise<void> {
    let match: TestMatch | undefined;
    await this.respond(context, 'partida-teste', async () => {
      match = await loadTestMatch(context);
      return testMatchResponse(match, { revealed: 1 });
    });
    if (!match) return;

    try {
      const frames = matchFrames(match);
      for (let index = 1; index < frames.length; index += 1) {
        // O quadro anterior decide a pausa: um gol fica mais tempo na tela antes do próximo.
        const hold = frames[index - 1]?.hold ?? 1;
        await new Promise((resolve) =>
          setTimeout(resolve, PartidaTesteCommand.frameDelayMs * hold),
        );
        await context.editOrReply(await testMatchResponse(match, frames[index] ?? { revealed: 1 }));
      }
    } catch (error) {
      console.error('Failed to narrate /partida-teste.', error);
    }
  }
}

async function loadTestMatch(context: CommandContext<typeof options>): Promise<TestMatch> {
  try {
    return await simulateTestMatch({
      identity: identity(context),
      opponentId: context.options.adversario?.id ?? null,
      seed: context.options.seed ?? null,
    });
  } catch (error) {
    if (error instanceof ApiClientError && (error.status === 400 || error.status === 404))
      throw new CommandInputError(error.message.replace(/^.*?status \d+: /, ''));
    throw error;
  }
}
