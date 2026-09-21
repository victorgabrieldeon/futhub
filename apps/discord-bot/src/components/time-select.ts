import { ComponentCommand, MessageFlags } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import { loadClub, reloadTeam, setCaptain, setFormation, setLineupCard } from '../team-api.js';
import {
  type TeamPosition,
  type TeamTab,
  parseTeamAction,
  updateTeamSession,
} from '../team-session.js';
import { teamResponse } from '../team.js';

export default class TimeSelectComponent extends ComponentCommand {
  componentType = 'StringSelect' as const;

  filter(context: ComponentContext<'StringSelect'>): boolean {
    return context.customId.startsWith('tm1:');
  }

  async run(context: ComponentContext<'StringSelect'>): Promise<void> {
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
    const value = context.interaction.values[0];
    if (!value) {
      await context.write({ content: 'Seleção inválida.', flags: MessageFlags.Ephemeral });
      return;
    }

    await context.deferUpdate();
    try {
      const { session, action, argument } = parsed;
      if (action === 'tab') {
        if (!isTab(value)) throw new Error('Invalid team tab.');
        const updated = updateTeamSession(session, {
          tab: value,
          selectedCardId: null,
          confirmSale: false,
          club: value === 'club' ? await loadClub(session.identity) : session.club,
        });
        await context.editOrReply(await teamResponse(updated));
        return;
      }
      if (action === 'card') {
        const selectedCardId = session.team.inventory.items.some(
          ({ userCardId }) => userCardId === value,
        )
          ? value
          : null;
        const updated = updateTeamSession(session, {
          selectedCardId,
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
          selectedCardId: null,
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
          selectedCardId: null,
          confirmSale: false,
        });
        await context.editOrReply(await teamResponse(updated));
        return;
      }
      let notice: string;
      if (action === 'formation') {
        await setFormation(session.identity, value);
        notice = '✅ Formação e escalação atualizadas.';
      } else if (action === 'captain') {
        await setCaptain(session.identity, value);
        notice = '✅ Capitão definido.';
      } else if (action === 'lineup') {
        if (!isPosition(value) || session.selectedCardId !== argument)
          throw new Error('Invalid lineup selection.');
        await setLineupCard(session.identity, argument, value);
        notice = '✅ Jogador escalado.';
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
          '❌ Não foi possível atualizar o time. Tente novamente.',
        ),
      );
    }
  }
}

function isTab(value: string): value is TeamTab {
  return ['overview', 'lineup', 'inventory', 'packs', 'sale', 'club'].includes(value);
}

function isPosition(value: string): value is TeamPosition {
  return ['GOL', 'LD', 'LE', 'ZAG', 'VOL', 'MA', 'MC', 'PD', 'PE', 'CA'].includes(value);
}
