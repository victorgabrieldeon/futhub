import type { DiscordIdentityDto } from '@futhub/api-client';
import { Declare } from 'seyfert';
import type { CommandContext } from 'seyfert';

import {
  defaultTeamView,
  loadClub,
  loadLeague,
  loadOverviewLeague,
  loadOverviewMissions,
  loadTeam,
} from '../features/team/team-api.js';
import { type TeamTab, createTeamSession } from '../features/team/team-session.js';
import { teamResponse } from '../features/team/team.js';
import { FutHubCommand, identity } from './shared.js';

export async function openTeamPanel(
  player: DiscordIdentityDto,
  ephemeral: boolean,
  tab: TeamTab = 'overview',
) {
  const [team, club, league, missions] = await Promise.all([
    loadTeam(player, { ...defaultTeamView, sellable: tab === 'sale' }),
    tab === 'club' ? loadClub(player) : null,
    tab === 'league' ? loadLeague(player) : tab === 'overview' ? loadOverviewLeague(player) : null,
    tab === 'overview' ? loadOverviewMissions(player) : null,
  ]);
  const session = createTeamSession({
    ownerId: player.id,
    identity: player,
    ephemeral,
    tab,
    filters: { name: '', position: null, collectionId: null, sort: 'overall' },
    selectedCardIds: [],
    confirmSale: false,
    team,
    club,
    league,
    missions,
  });
  return teamResponse(session);
}

export function createTeamPanel(context: CommandContext, tab: TeamTab = 'overview') {
  return openTeamPanel(identity(context), Boolean(context.interaction), tab);
}

@Declare({
  name: 'time',
  description: 'Seu clube: escalação, elenco, packs e partidas de liga, amistoso ou contra bots.',
})
export default class TimeCommand extends FutHubCommand {
  async run(context: CommandContext): Promise<void> {
    await this.respond(context, 'time', () => createTeamPanel(context));
  }
}
