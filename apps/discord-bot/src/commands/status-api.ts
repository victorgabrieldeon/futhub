import { healthControllerHealth } from '@futhub/api-client';
import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { notice } from '../core/ui.js';
import { FutHubCommand } from './shared.js';

@Declare({ name: 'status-api', description: 'Verifique se o servidor do jogo está online.' })
export default class StatusApiCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'status-api', async () => {
      const startedAt = Date.now();
      const { status } = await healthControllerHealth();
      return status === 'ok'
        ? notice('success', 'Servidor online', `Respondeu em ${Date.now() - startedAt} ms.`)
        : notice('error', 'Servidor indisponível', 'O jogo pode falhar até ele voltar.');
    });
  }
}
