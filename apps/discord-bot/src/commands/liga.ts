import { getV1LeagueDiscordUserId } from '@futhub/api-client';
import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { formatLeagueStatus } from '../game.js';
import { FutHubCommand, identity } from './shared.js';

@Declare({ name: 'liga', description: 'Veja sua divisão, campanha e estado da fila.' })
export default class LigaCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'liga', async () =>
      formatLeagueStatus(await getV1LeagueDiscordUserId(identity(context).id)),
    );
  }
}
