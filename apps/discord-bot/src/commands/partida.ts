import { getV1MatchesMatchId } from '@futhub/api-client';
import { Declare, Options, createStringOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { formatMatch } from '../game.js';
import { FutHubCommand, requiredText } from './shared.js';

const options = {
  partida_id: createStringOption({ description: 'ID da partida.', required: true }),
};

@Declare({ name: 'partida', description: 'Veja placar e eventos de uma partida.' })
@Options(options)
export default class PartidaCommand extends FutHubCommand {
  async run(context: CommandContext<typeof options>): Promise<void> {
    await this.respond(context, 'partida', async () =>
      formatMatch(
        await getV1MatchesMatchId(requiredText(context.options.partida_id, 'partida_id')),
      ),
    );
  }
}
