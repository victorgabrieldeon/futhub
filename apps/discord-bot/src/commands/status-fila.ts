import { getV1RankedStatusDiscordUserId } from '@futhub/api-client';
import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { formatQueueStatus } from '../game.js';
import { FutHubCommand, identity } from './shared.js';

@Declare({ name: 'status-fila', description: 'Veja sua partida pendente ou posição na fila.' })
export default class StatusFilaCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'status-fila', async () =>
      formatQueueStatus(await getV1RankedStatusDiscordUserId(identity(context).id)),
    );
  }
}
