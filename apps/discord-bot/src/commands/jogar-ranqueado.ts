import { joinRankedQueue } from '@futhub/api-client';
import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { formatRankedQueue } from '../game.js';
import { FutHubCommand, identity } from './shared.js';

@Declare({ name: 'jogar-ranqueado', description: 'Entre na fila ranqueada.' })
export default class JogarRanqueadoCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'jogar-ranqueado', async () =>
      formatRankedQueue(await joinRankedQueue(identity(context))),
    );
  }
}
