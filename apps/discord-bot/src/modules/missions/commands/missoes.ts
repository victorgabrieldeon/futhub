import { listMissions } from '@futhub/api-client';
import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { FutHubCommand, identity } from '../../../shared/command.js';
import { formatMissions } from '../format.js';

@Declare({ name: 'missoes', description: 'Veja missões diárias, semanais e mensais.' })
export default class MissoesCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'missoes', async () =>
      formatMissions(await listMissions(identity(context))),
    );
  }
}
