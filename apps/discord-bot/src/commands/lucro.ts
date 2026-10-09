import { executeLucro } from '@futhub/api-client';
import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { botResponse, identityData } from '../bot-response.js';
import { lucroData } from '../response-data.js';
import { FutHubCommand, identity } from './shared.js';

@Declare({ name: 'lucro', description: 'Receba lucro e aumente seu saldo.' })
export default class LucroCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'lucro', async () => {
      const user = identity(context);
      const { key, data } = lucroData(await executeLucro(user), new Date());
      return botResponse(key, { ...identityData(user), ...data });
    });
  }
}
