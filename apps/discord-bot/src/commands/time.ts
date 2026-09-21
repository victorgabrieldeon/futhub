import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { loadClub, loadLeague, loadTeam } from '../team-api.js';
import { createTeamSession, type TeamTab } from '../team-session.js';
import { teamResponse } from '../team.js';
import { FutHubCommand, identity } from './shared.js';

export async function createTeamPanel(context: CommandContext, tab: TeamTab = 'overview') {
  const player = identity(context);
  const [team, club, league] = await Promise.all([
    loadTeam(player, {
      page: 1,
      name: '',
      position: null,
      collectionId: null,
      sort: 'overall',
    }),
    tab === 'club' ? loadClub(player) : null,
    tab === 'league' ? loadLeague(player) : null,
  ]);
  const session = createTeamSession({
    ownerId: context.author.id,
    identity: player,
    ephemeral: Boolean(context.interaction),
    tab,
    filters: { name: '', position: null, collectionId: null, sort: 'overall' },
    selectedCardId: null,
    confirmSale: false,
    team,
    club,
    league,
  });
  return teamResponse(session);
}

@Declare({ name: 'time', description: 'Gerencie seu time e clube.' })
export default class TimeCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'time', () => createTeamPanel(context));
  }
}
