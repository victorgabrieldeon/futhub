import { MessageFlags, ModalCommand } from 'seyfert';
import type { ModalContext } from 'seyfert';

import { updateTeamPanel } from '../panel.js';
import { teamResponse } from '../response.js';
import { parseTeamAction } from '../session.js';

export default class TimeSearchComponent extends ModalCommand {
  filter(context: ModalContext): boolean {
    return context.customId.startsWith('tm2:');
  }

  async run(context: ModalContext): Promise<void> {
    const parsed = parseTeamAction(context.customId, context.interaction.user.id);
    if (parsed.kind !== 'owned' || parsed.action !== 'search') {
      await context.write({
        content:
          parsed.kind === 'foreign'
            ? 'Este painel pertence a outro jogador.'
            : 'Este painel expirou. Use `/time` ou `!time` novamente.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const input = context.getInputValue('name') ?? '';
    const name = (Array.isArray(input) ? (input[0] ?? '') : input).trim().slice(0, 80);
    await context.deferUpdate();
    try {
      await context.editOrReply(await updateTeamPanel(parsed.session, { kind: 'search', name }));
    } catch (error) {
      console.error('Failed to search team inventory.', error);
      await context.editOrReply(
        await teamResponse(
          parsed.session,
          '❌ Não foi possível buscar o jogador. Tente novamente.',
        ),
      );
    }
  }
}
