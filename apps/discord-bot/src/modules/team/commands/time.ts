import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { FutHubCommand, identity } from '../../../shared/command.js';
import { openTeamPanel } from '../panel.js';

@Declare({ name: 'time', description: 'Gerencie seu time e clube.' })
export default class TimeCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'time', () =>
      openTeamPanel(identity(context), Boolean(context.interaction)),
    );
  }
}
