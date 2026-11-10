import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { helpResponse } from '../features/help.js';
import { FutHubCommand } from './shared.js';

@Declare({ name: 'ajuda', description: 'Aprenda a jogar e veja todos os comandos.' })
export default class AjudaCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'ajuda', async () =>
      helpResponse(context.author.id, Boolean(context.interaction)),
    );
  }
}
