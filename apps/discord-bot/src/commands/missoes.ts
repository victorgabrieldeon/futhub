import { listMissions } from '@futhub/api-client';
import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { missionsReply } from '../core/replies.js';
import { FutHubCommand, identity } from './shared.js';

@Declare({ name: 'missoes', description: 'Veja missões diárias, semanais e mensais.' })
export default class MissoesCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'missoes', async () => {
      const player = identity(context);
      return missionsReply(player, await listMissions(player));
    });
  }
}
