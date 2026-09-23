import { healthControllerHealth } from '@futhub/api-client';
import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { FutHubCommand } from '../../../shared/command.js';

@Declare({ name: 'status-api', description: 'Verifique se API está disponível.' })
export default class StatusApiCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'status-api', async () => {
      const { status } = await healthControllerHealth();
      return status === 'ok' ? 'API online.' : 'API indisponível.';
    });
  }
}
