import { purchasePack } from '@futhub/api-client';
import { Declare, Options, createStringOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { formatPackPurchase } from '../game.js';
import { FutHubCommand, identity, requiredText } from './shared.js';

const options = { pack_id: createStringOption({ description: 'ID do pack.', required: true }) };

@Declare({ name: 'comprar-pack', description: 'Compre um pack pelo ID.' })
@Options(options)
export default class ComprarPackCommand extends FutHubCommand {
  async run(context: CommandContext<typeof options>): Promise<void> {
    await this.respond(context, 'comprar-pack', async () =>
      formatPackPurchase(
        await purchasePack(requiredText(context.options.pack_id, 'pack_id'), {
          identity: identity(context),
        }),
      ),
    );
  }
}
