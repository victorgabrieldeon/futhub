import { sellCards } from '@futhub/api-client';
import { Declare, Options, createStringOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { formatCardsSale } from '../game.js';
import { CommandInputError, FutHubCommand, cardIds, identity } from './shared.js';

const tabs = [{ name: 'Vender jogadores', value: 'vender' }] as const;
const options = {
  aba: createStringOption({ description: 'Área do time.', required: true, choices: tabs }),
  ids: createStringOption({
    description: 'IDs das cartas separados por vírgula.',
    required: false,
  }),
};

@Declare({ name: 'time', description: 'Gerencie seu time.' })
@Options(options)
export default class TimeCommand extends FutHubCommand {
  async run(context: CommandContext<typeof options>): Promise<void> {
    await this.respond(context, 'time', async () => {
      if (context.options.aba === 'vender') {
        return formatCardsSale(
          await sellCards({
            identity: identity(context),
            userCardIds: [...cardIds(context.options.ids ?? '')],
          }),
        );
      }
      throw new CommandInputError('Aba do time inválida.');
    });
  }
}
