import { purchasePack } from '@futhub/api-client';
import { Declare, Options, createStringOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { botResponse, identityData } from '../bot-response.js';
import { packPurchaseData } from '../response-data.js';
import { FutHubCommand, identity, requiredText } from './shared.js';

const options = { pack_id: createStringOption({ description: 'ID do pack.', required: true }) };

@Declare({ name: 'comprar-pack', description: 'Compre um pack pelo ID.' })
@Options(options)
export default class ComprarPackCommand extends FutHubCommand {
  async run(context: CommandContext<typeof options>): Promise<void> {
    await this.respond(context, 'comprar-pack', async () => {
      const user = identity(context);
      const packId = requiredText(context.options.pack_id, 'pack_id');
      const result = await purchasePack(packId, { identity: user });
      return botResponse('pack.purchase', {
        ...identityData(user),
        ...packPurchaseData(packId, result),
      });
    });
  }
}
