import { ComponentCommand, Label, MessageFlags, Modal, TextInput } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import {
  autoLineup,
  reloadTeam,
  sellTeamCard,
  setTactic,
  toggleFavorite,
  upgradeClubStadium,
} from '../team-api.js';
import {
  type TeamSession,
  parseTeamAction,
  teamCustomId,
  updateTeamSession,
} from '../team-session.js';
import { teamResponse } from '../team.js';

export default class TimeButtonComponent extends ComponentCommand {
  componentType = 'Button' as const;

  filter(context: ComponentContext<'Button'>): boolean {
    return context.customId.startsWith('tm1:');
  }

  async run(context: ComponentContext<'Button'>): Promise<void> {
    const parsed = parseTeamAction(context.customId, context.interaction.user.id);
    if (parsed.kind !== 'owned') {
      await context.write({
        content:
          parsed.kind === 'foreign'
            ? 'Este painel pertence a outro jogador.'
            : 'Este painel expirou. Use `/time` ou `!time` novamente.',
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

    await context.deferUpdate();
    try {
      const { session, action, argument } = parsed;
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
          selectedCardId: null,
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
          selectedCardId: null,
          confirmSale: false,
        });
        await context.editOrReply(await teamResponse(updated));
        return;
      }

      let notice: string | undefined;
      if (action === 'stadium-upgrade') {
        const club = await upgradeClubStadium(session.identity);
        const updated = updateTeamSession(session, {
          club,
          team: { ...session.team, balance: club.balance },
        });
        await context.editOrReply(await teamResponse(updated, '✅ Estádio melhorado.'));
        return;
      }
      if (action === 'auto') {
        await autoLineup(session.identity);
        notice = '✅ Melhor escalação compatível aplicada.';
      } else if (action === 'tactic') {
        if (!isTactic(argument)) throw new Error('Invalid tactic.');
        await setTactic(session.identity, argument);
        notice = '✅ Tática atualizada.';
      } else if (action === 'favorite') {
        await toggleFavorite(session.identity, argument);
        notice = '✅ Favorito atualizado.';
      } else if (action === 'sell-confirm') {
        if (session.selectedCardId !== argument) throw new Error('Selected card changed.');
        const updated = updateTeamSession(session, { confirmSale: true });
        await context.editOrReply(
          await teamResponse(updated, '⚠️ Confirme a venda. Esta ação é definitiva.'),
        );
        return;
      } else if (action === 'sell') {
        const card = session.team.inventory.items.find(({ userCardId }) => userCardId === argument);
        if (
          session.selectedCardId !== argument ||
          !card ||
          card.holder ||
          card.favorite ||
          card.captain
        )
          throw new Error('Card is not available for sale.');
        const sale = await sellTeamCard(session.identity, argument);
        notice = `✅ ${card.name} vendido por ${sale.amount}. Saldo: ${sale.balance}.`;
      } else {
        throw new Error('Unsupported team button action.');
      }

      const team = await reloadTeam(session);
      const updated = updateTeamSession(session, {
        team,
        selectedCardId: action === 'sell' ? null : session.selectedCardId,
        confirmSale: false,
      });
      await context.editOrReply(await teamResponse(updated, notice));
    } catch (error) {
      console.error('Failed to update team panel.', error);
      await context.editOrReply(
        await teamResponse(
          parsed.session,
          '❌ Não foi possível atualizar o time. Tente novamente.',
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
