import { listMissions } from '@futhub/api-client';
import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { botResponse, identityData } from '../bot-response.js';
import { missionsData } from '../response-data.js';
import { FutHubCommand, identity } from './shared.js';

@Declare({ name: 'missoes', description: 'Veja missões diárias, semanais e mensais.' })
export default class MissoesCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'missoes', async () => {
      const user = identity(context);
      return botResponse('missoes.list', {
        ...identityData(user),
        ...missionsData(await listMissions(user)),
      });
    });
  }
}
