import { executeLucro } from '@futhub/api-client';
import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { lucroReply } from '../core/replies.js';
import { FutHubCommand, identity } from './shared.js';

@Declare({ name: 'lucro', description: 'Receba as moedas do caixa do clube.' })
export default class LucroCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'lucro', async () => {
      const player = identity(context);
      return lucroReply(player, await executeLucro(player), new Date());
    });
  }
}
