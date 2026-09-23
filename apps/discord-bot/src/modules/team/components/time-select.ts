import { ComponentCommand, MessageFlags } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import { updateTeamPanel } from '../panel.js';
import { teamResponse } from '../response.js';
import { parseTeamAction } from '../session.js';

export default class TimeSelectComponent extends ComponentCommand {
  componentType = 'StringSelect' as const;

  filter(context: ComponentContext<'StringSelect'>): boolean {
    return context.customId.startsWith('tm2:');
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
      await context.editOrReply(
        await updateTeamPanel(parsed.session, {
          kind: 'select',
          action: parsed.action,
          argument: parsed.argument,
          value,
        }),
      );
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
