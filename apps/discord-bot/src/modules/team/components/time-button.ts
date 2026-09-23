import { ComponentCommand, Label, MessageFlags, Modal, TextInput } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import { updateTeamPanel } from '../panel.js';
import { teamResponse } from '../response.js';
import { parseTeamAction, teamCustomId } from '../session.js';

export default class TimeButtonComponent extends ComponentCommand {
  componentType = 'Button' as const;

  filter(context: ComponentContext<'Button'>): boolean {
    return context.customId.startsWith('tm2:');
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
      await context.editOrReply(
        await updateTeamPanel(parsed.session, {
          kind: 'button',
          action: parsed.action,
          argument: parsed.argument,
        }),
      );
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
