import { ModalCommand } from 'seyfert';
import type { ModalContext } from 'seyfert';

import type { BotMessage } from '../core/bot-response.js';
import { EMOJI } from '../core/emojis.js';
import { sessionNotice } from '../core/ui.js';
import { reloadTeam } from '../features/team/team-api.js';
import { parseTeamAction, updateTeamSession } from '../features/team/team-session.js';
import { teamResponse } from '../features/team/team.js';

export default class TimeSearchComponent extends ModalCommand {
  filter(context: ModalContext): boolean {
    return context.customId.startsWith('tm1:');
  }

  async run(context: ModalContext): Promise<void> {
    const parsed = parseTeamAction(context.customId, context.interaction.user.id);
    if (parsed.kind !== 'owned' || parsed.action !== 'search') {
      await context.write(
        sessionNotice(parsed.kind === 'foreign' ? 'foreign' : 'expired', 'time') as BotMessage,
      );
      return;
    }
    const input = context.getInputValue('name') ?? '';
    const name = (Array.isArray(input) ? (input[0] ?? '') : input).trim().slice(0, 80);
    await context.deferUpdate();
    try {
      const filters = { ...parsed.session.filters, name };
      const team = await reloadTeam({ ...parsed.session, filters });
      const updated = updateTeamSession(parsed.session, {
        filters,
        team,
        selectedCardIds: [],
        confirmSale: false,
      });
      await context.editOrReply(await teamResponse(updated));
    } catch (error) {
      console.error('Failed to search team inventory.', error);
      await context.editOrReply(
        await teamResponse(
          parsed.session,
          `${EMOJI.erro} Não foi possível buscar o jogador. Tente novamente.`,
        ),
      );
    }
  }
}
