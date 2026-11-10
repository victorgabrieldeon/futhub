import { redeemCode } from '@futhub/api-client';
import { Declare, Options, createStringOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { redeemReply } from '../core/replies.js';
import { FutHubCommand, identity, requiredText } from './shared.js';

const options = {
  codigo: createStringOption({ description: 'Código de resgate.', required: true }),
};

@Declare({ name: 'resgatar', description: 'Resgate um código promocional.' })
@Options(options)
export default class ResgatarCommand extends FutHubCommand {
  async run(context: CommandContext<typeof options>): Promise<void> {
    await this.respond(context, 'resgatar', async () => {
      const user = identity(context);
      const code = requiredText(context.options.codigo, 'o código');
      return redeemReply(user, code, await redeemCode({ identity: user, code }));
    });
  }
}
