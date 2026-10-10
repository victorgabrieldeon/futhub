import { redeemCode } from '@futhub/api-client';
import { Declare, MessageFlags, Options, createStringOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { botResponse, identityData } from '../bot-response.js';
import { redeemData } from '../response-data.js';
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
      const { key, data } = redeemData(code, await redeemCode({ identity: user, code }));
      // Codes are shared promotions; keep the typed code out of public channels.
      return {
        ...(await botResponse(key, { ...identityData(user), ...data })),
        flags: MessageFlags.Ephemeral,
      };
    });
  }
}
