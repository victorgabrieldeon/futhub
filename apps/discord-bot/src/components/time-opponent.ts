import { ComponentCommand, MessageFlags } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import type { BotMessage } from '../core/bot-response.js';
import { EMOJI } from '../core/emojis.js';
import { sessionNotice } from '../core/ui.js';
import { parseTeamAction, updateTeamSession } from '../features/team/team-session.js';
import { teamResponse } from '../features/team/team.js';

export default class TimeOpponentComponent extends ComponentCommand {
  componentType = 'UserSelect' as const;

  filter(context: ComponentContext<'UserSelect'>): boolean {
    return context.customId.startsWith('tm1:');
  }

  async run(context: ComponentContext<'UserSelect'>): Promise<void> {
    const parsed = parseTeamAction(context.customId, context.interaction.user.id);
    if (parsed.kind !== 'owned') {
      await context.write(
        sessionNotice(parsed.kind === 'foreign' ? 'foreign' : 'expired', 'time') as BotMessage,
      );
      return;
    }
    const { session, action } = parsed;
    if (session.matchBusy) {
      await context.write({
        content: 'A partida está em andamento. Aguarde o apito final.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const opponentId = context.interaction.values[0];
    if (
      action !== 'opponent' ||
      !opponentId ||
      !/^\d{17,20}$/.test(opponentId) ||
      opponentId === session.ownerId
    ) {
      await context.write({
        content: 'Escolha outro jogador para o amistoso. Você não pode enfrentar seu próprio time.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await context.deferUpdate();
    try {
      const updated = updateTeamSession(session, {
        tab: 'match',
        matchMode: 'friendly',
        opponentId,
        practice: null,
      });
      await context.editOrReply(await teamResponse(updated));
    } catch (error) {
      console.error('Failed to select friendly opponent.', error);
      await context.editOrReply(
        await teamResponse(
          session,
          `${EMOJI.erro} Não foi possível selecionar o adversário. Tente novamente.`,
        ),
      );
    }
  }
}
