import { ApiClientError, type CompletedMissionDto } from '@futhub/api-client';

import { ComponentCommand, Label, MessageFlags, Modal, TextInput } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import type { BotMessage } from '../core/bot-response.js';
import { EMOJI } from '../core/emojis.js';
import { juice, sleep } from '../core/juice.js';
import { sendMissionNotice } from '../core/mission-notice.js';
import { sessionNotice } from '../core/ui.js';
import {
  autoLineup,
  loadLeague,
  queueLeagueMatch,
  reloadTeam,
  sellTeamCards,
  setTactic,
  toggleFavorite,
  upgradeClubStadium,
} from '../features/team/team-api.js';
import { playTeamMatch } from '../features/team/team-match.js';
import {
  type TeamSession,
  parseTeamAction,
  teamCustomId,
  updateTeamSession,
} from '../features/team/team-session.js';
import { teamResponse } from '../features/team/team.js';

const SEARCH_TICKS = 4;

export default class TimeButtonComponent extends ComponentCommand {
  componentType = 'Button' as const;

  filter(context: ComponentContext<'Button'>): boolean {
    return context.customId.startsWith('tm1:');
  }

  async run(context: ComponentContext<'Button'>): Promise<void> {
    const parsed = parseTeamAction(context.customId, context.interaction.user.id);
    if (parsed.kind !== 'owned') {
      await context.write(
        sessionNotice(parsed.kind === 'foreign' ? 'foreign' : 'expired', 'time') as BotMessage,
      );
      return;
    }
    if (parsed.session.matchBusy) {
      await context.write({
        content: 'A partida está em andamento. Aguarde o apito final.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (parsed.action === 'search') {
      const input = new TextInput()
        .setCustomId('name')
        .setStyle(1)
        .setLength({ max: 80 })
        .setRequired(false);
      if (parsed.session.filters.name) input.setValue(parsed.session.filters.name);
      await context.modal(
        new Modal()
          .setCustomId(teamCustomId(parsed.session, 'search'))
          .setTitle('Buscar jogador')
          .setComponents([new Label().setLabel('Nome do jogador').setComponent(input)]),
      );
      return;
    }

    if (parsed.action === 'match-play') {
      await playTeamMatch(context, parsed.session);
      return;
    }
    await context.deferUpdate();
    try {
      const { session, action, argument } = parsed;
      if (action === 'match-mode') {
        if (argument !== 'league' && argument !== 'friendly' && argument !== 'bots')
          throw new Error('Invalid match mode.');
        const league = argument === 'league' ? await loadLeague(session.identity) : session.league;
        const updated = updateTeamSession(session, {
          tab: 'match',
          matchMode: argument,
          practice: null,
          league,
        });
        await context.editOrReply(await teamResponse(updated));
        return;
      }
      if (action === 'bot-difficulty') {
        if (argument !== 'easy' && argument !== 'medium' && argument !== 'hard')
          throw new Error('Invalid bot difficulty.');
        const updated = updateTeamSession(session, {
          tab: 'match',
          matchMode: 'bots',
          botDifficulty: argument,
          practice: null,
        });
        await context.editOrReply(await teamResponse(updated));
        return;
      }
      if (action === 'league-refresh' || action === 'league-queue') {
        try {
          const league =
            action === 'league-queue'
              ? await queueLeagueMatch(session.identity)
              : await loadLeague(session.identity);
          let updated = updateTeamSession(session, { league });
          // Enquanto procura, o painel anima e confere sozinho algumas vezes antes de pedir clique.
          for (let tick = 0; juice.enabled && tick < SEARCH_TICKS; tick += 1) {
            if (updated.league?.status.queue?.kind !== 'waiting') break;
            await context.editOrReply(await teamResponse(updated, undefined, { searchTick: tick }));
            await sleep(juice.frameDelayMs * 1.5);
            updated = updateTeamSession(updated, { league: await loadLeague(session.identity) });
          }
          await context.editOrReply(await teamResponse(updated));
        } catch (error) {
          console.error('Failed to update league panel.', error);
          const notice =
            action === 'league-queue' && error instanceof ApiClientError && error.status === 400
              ? `${EMOJI.alerta} Complete sua escalação com 11 titulares compatíveis antes de buscar partida.`
              : `${EMOJI.erro} Não foi possível atualizar a liga. Tente novamente.`;
          await context.editOrReply(await teamResponse(session, notice));
        }
        return;
      }
      if (action === 'cancel') {
        const updated = updateTeamSession(session, { confirmSale: false });
        await context.editOrReply(await teamResponse(updated));
        return;
      }
      if (action === 'page') {
        const page = Number(argument);
        if (!Number.isSafeInteger(page) || page < 1) throw new Error('Invalid inventory page.');
        const team = await reloadTeam(session, page);
        const updated = updateTeamSession(session, {
          team,
          selectedCardIds: [],
          confirmSale: false,
        });
        await context.editOrReply(await teamResponse(updated));
        return;
      }
      if (action === 'sort') {
        if (!isSort(argument)) throw new Error('Invalid inventory sort.');
        const filters = { ...session.filters, sort: argument };
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

      let notice: string | undefined;
      let completedMissions: readonly CompletedMissionDto[] = [];
      if (action === 'stadium-upgrade') {
        const club = await upgradeClubStadium(session.identity);
        const updated = updateTeamSession(session, {
          club,
          team: { ...session.team, balance: club.balance },
        });
        await context.editOrReply(
          await teamResponse(
            updated,
            `## ${EMOJI.estadio} Estádio nível ${club.stadium.level}!\n${EMOJI.lucro} Bilheteria agora rende **+${club.stadium.ticketRevenue.toLocaleString('pt-BR')}** por fechamento.`,
          ),
        );
        return;
      }
      if (action === 'auto') {
        await autoLineup(session.identity);
        notice = `${EMOJI.sucesso} Melhor escalação compatível aplicada.`;
      } else if (action === 'tactic') {
        if (!isTactic(argument)) throw new Error('Invalid tactic.');
        await setTactic(session.identity, argument);
        notice = `${EMOJI.sucesso} Tática atualizada.`;
      } else if (action === 'favorite') {
        await toggleFavorite(session.identity, argument);
        notice = `${EMOJI.sucesso} Favorito atualizado.`;
      } else if (action === 'sell-confirm') {
        if (session.selectedCardIds.length === 0) throw new Error('No card selected for sale.');
        const updated = updateTeamSession(session, { confirmSale: true });
        await context.editOrReply(
          await teamResponse(updated, `${EMOJI.alerta} Confirme a venda. Esta ação é definitiva.`),
        );
        return;
      } else if (action === 'sell') {
        const cards = session.team.inventory.items.filter(({ userCardId }) =>
          session.selectedCardIds.includes(userCardId),
        );
        if (
          !session.confirmSale ||
          cards.length === 0 ||
          cards.length !== session.selectedCardIds.length ||
          cards.some((card) => card.holder || card.favorite || card.captain)
        )
          throw new Error('Card is not available for sale.');
        const sale = await sellTeamCards(session.identity, session.selectedCardIds);
        const sold =
          cards.length === 1
            ? `**${cards[0]?.name}** vendido`
            : `**${cards.length} jogadores** vendidos`;
        notice = `## ${EMOJI.venda} +${sale.amount.toLocaleString('pt-BR')} ${EMOJI.moeda}\n${sold} · saldo ${sale.balance.toLocaleString('pt-BR')}`;
        completedMissions = sale.completedMissions;
      } else {
        throw new Error('Unsupported team button action.');
      }

      const team = await reloadTeam(session);
      const updated = updateTeamSession(session, {
        team,
        selectedCardIds: action === 'sell' ? [] : session.selectedCardIds,
        confirmSale: false,
      });
      await context.editOrReply(await teamResponse(updated, notice));
      await sendMissionNotice(
        (message) =>
          context.followup({ ...message, flags: (message.flags ?? 0) | MessageFlags.Ephemeral }),
        session.identity,
        completedMissions,
      );
    } catch (error) {
      console.error('Failed to update team panel.', error);
      await context.editOrReply(
        await teamResponse(
          parsed.session,
          `${EMOJI.erro} Não foi possível atualizar o time. Tente novamente.`,
        ),
      );
    }
  }
}

function isTactic(value: string): value is TeamSession['team']['tactic'] {
  return ['defensive', 'balanced', 'offensive'].includes(value);
}

function isSort(value: string): value is TeamSession['filters']['sort'] {
  return ['overall', 'name', 'recent'].includes(value);
}
