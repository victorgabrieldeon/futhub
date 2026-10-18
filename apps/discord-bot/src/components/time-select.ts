import { ComponentCommand, MessageFlags } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import type { BotMessage } from '../core/bot-response.js';
import { EMOJI } from '../core/emojis.js';
import { sessionNotice } from '../core/ui.js';
import {
  loadClub,
  loadLeague,
  loadOverviewLeague,
  loadOverviewMissions,
  reloadTeam,
  setCaptain,
  setFormation,
  setLineupCard,
} from '../features/team/team-api.js';
import {
  type TeamPosition,
  isTeamTab,
  parseTeamAction,
  updateTeamSession,
} from '../features/team/team-session.js';
import { teamResponse } from '../features/team/team.js';

export default class TimeSelectComponent extends ComponentCommand {
  componentType = 'StringSelect' as const;

  filter(context: ComponentContext<'StringSelect'>): boolean {
    return context.customId.startsWith('tm1:');
  }

  async run(context: ComponentContext<'StringSelect'>): Promise<void> {
    const parsed = parseTeamAction(context.customId, context.interaction.user.id);
    if (parsed.kind !== 'owned') {
      await context.write(
        sessionNotice(parsed.kind === 'foreign' ? 'foreign' : 'expired', 'time') as BotMessage,
      );
      return;
    }
    const value = context.interaction.values[0];
    if (parsed.session.matchBusy) {
      await context.write({
        content: 'A partida está em andamento. Aguarde o apito final.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!value) {
      await context.write({
        content: `${EMOJI.alerta} Seleção inválida.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await context.deferUpdate();
    try {
      const { session, action, argument } = parsed;
      if (action === 'tab') {
        if (!isTeamTab(value)) throw new Error('Invalid team tab.');
        const overview = value === 'overview';
        // A aba Venda lista só cartas vendáveis; entrar ou sair dela exige recarregar o elenco.
        const sale = value === 'sale' || session.tab === 'sale';
        const [team, club, league, missions] = await Promise.all([
          overview
            ? reloadTeam({ ...session, tab: value }, session.team.inventory.page)
            : sale
              ? reloadTeam({ ...session, tab: value })
              : session.team,
          value === 'club' ? loadClub(session.identity) : session.club,
          value === 'league' || (value === 'match' && session.matchMode === 'league')
            ? loadLeague(session.identity)
            : overview
              ? loadOverviewLeague(session.identity)
              : session.league,
          overview ? loadOverviewMissions(session.identity) : session.missions,
        ]);
        const updated = updateTeamSession(session, {
          tab: value,
          selectedCardIds: [],
          confirmSale: false,
          team,
          club,
          league,
          missions,
        });
        await context.editOrReply(await teamResponse(updated));
        return;
      }
      if (action === 'card') {
        const owned = new Set(session.team.inventory.items.map(({ userCardId }) => userCardId));
        const values = session.tab === 'sale' ? context.interaction.values : [value];
        const updated = updateTeamSession(session, {
          selectedCardIds: values.filter((id) => owned.has(id)),
          confirmSale: false,
        });
        await context.editOrReply(await teamResponse(updated));
        return;
      }

      if (action === 'position-filter') {
        if (value !== 'all' && !isPosition(value)) throw new Error('Invalid position filter.');
        const filters = { ...session.filters, position: value === 'all' ? null : value };
        const team = await reloadTeam({ ...session, filters });
        const updated = updateTeamSession(session, {
          filters,
          team,
          selectedCardIds: [],
          confirmSale: false,
        });
        await context.editOrReply(await teamResponse(updated));
        return;
      }
      if (action === 'collection-filter') {
        const collectionId = value === 'all' ? null : value;
        if (
          collectionId &&
          !session.team.collections.some((collection) => collection.id === collectionId)
        )
          throw new Error('Invalid collection filter.');
        const filters = { ...session.filters, collectionId };
        const team = await reloadTeam({ ...session, filters });
        const updated = updateTeamSession(session, {
          filters,
          team,
          selectedCardIds: [],
          confirmSale: false,
        });
        await context.editOrReply(await teamResponse(updated));
        return;
      }
      let notice: string;
      if (action === 'formation') {
        await setFormation(session.identity, value);
        notice = `${EMOJI.sucesso} Formação e escalação atualizadas.`;
      } else if (action === 'captain') {
        await setCaptain(session.identity, value);
        notice = `${EMOJI.sucesso} Capitão definido.`;
      } else if (action === 'lineup') {
        if (!isPosition(value) || session.selectedCardIds[0] !== argument)
          throw new Error('Invalid lineup selection.');
        await setLineupCard(session.identity, argument, value);
        notice = `${EMOJI.sucesso} Jogador escalado.`;
      } else {
        throw new Error('Unsupported team selection action.');
      }
      const team = await reloadTeam(session);
      const updated = updateTeamSession(session, { team, confirmSale: false });
      await context.editOrReply(await teamResponse(updated, notice));
    } catch (error) {
      console.error('Failed to update team selection.', error);
      await context.editOrReply(
        await teamResponse(
          parsed.session,
          `${EMOJI.erro} Não foi possível atualizar o time. Tente novamente.`,
        ),
      );
    }
  }
}

function isPosition(value: string): value is TeamPosition {
  return ['GOL', 'LD', 'LE', 'ZAG', 'VOL', 'MA', 'MC', 'PD', 'PE', 'CA'].includes(value);
}
