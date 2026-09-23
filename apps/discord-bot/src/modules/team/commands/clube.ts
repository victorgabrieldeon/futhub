import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { FutHubCommand, identity } from '../../../shared/command.js';
import { openTeamPanel } from '../panel.js';

@Declare({ name: 'clube', description: 'Abra a gestão do clube no painel do time.' })
export default class ClubeCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'clube', () =>
      openTeamPanel(identity(context), Boolean(context.interaction), 'club'),
    );
  }
}
