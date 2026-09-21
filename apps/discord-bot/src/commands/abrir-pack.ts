import { openPack } from '@futhub/api-client';
import { Declare, Options, createStringOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { formatPackOpen } from '../game.js';
import { FutHubCommand, identity, requiredText } from './shared.js';

const options = { pack_id: createStringOption({ description: 'ID do pack.', required: true }) };

@Declare({ name: 'abrir-pack', description: 'Abra um pack do seu inventário pelo ID.' })
@Options(options)
export default class AbrirPackCommand extends FutHubCommand {
  async run(context: CommandContext<typeof options>): Promise<void> {
    await this.respond(context, 'abrir-pack', async () =>
      formatPackOpen(
        await openPack(requiredText(context.options.pack_id, 'pack_id'), {
          identity: identity(context),
        }),
      ),
    );
  }
}
