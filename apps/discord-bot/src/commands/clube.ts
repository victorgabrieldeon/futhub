import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { FutHubCommand } from './shared.js';
import { createTeamPanel } from './time.js';

@Declare({ name: 'clube', description: 'Abra a gestão do clube no painel do time.' })
export default class ClubeCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'clube', () => createTeamPanel(context, 'club'));
  }
}
