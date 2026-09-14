import { executeLucro } from '@futhub/api-client';
import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { formatCommandResult } from '../lucro.js';
import { FutHubCommand, identity } from './shared.js';

@Declare({ name: 'lucro', description: 'Receba lucro e aumente seu saldo.' })
export default class LucroCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'lucro', async () =>
      formatCommandResult(await executeLucro(identity(context)), new Date()),
    );
  }
}
