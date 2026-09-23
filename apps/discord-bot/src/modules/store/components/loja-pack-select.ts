import { inspectPack } from '@futhub/api-client';
import { ComponentCommand, MessageFlags } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import { refreshApiClient } from '../../../shared/command.js';
import { updateStorePanel } from '../panel.js';
import {
  cardDetailResponse,
  packDetailResponse,
  storeErrorResponse,
  storeResponse,
} from '../response.js';
import { storeSessionManager } from '../state.js';

export default class LojaPackSelectComponent extends ComponentCommand {
  componentType = 'StringSelect' as const;

  filter(context: ComponentContext<'StringSelect'>): boolean {
    return context.customId.startsWith('ls1:');
  }

  async run(context: ComponentContext<'StringSelect'>): Promise<void> {
    const userId = context.interaction.user.id;
    const parsed = storeSessionManager.parse(context.customId, userId);
    if (parsed.kind === 'foreign') {
      await context.write({
        content: 'Esta loja pertence a outro jogador.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (parsed.kind !== 'owned') {
      await context.write({
        content: 'Esta loja expirou. Use `/loja` novamente.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const value = context.interaction.values[0];
    if (!value) {
      await context.write({
        content: 'Selecione uma opção válida.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (parsed.action.action === 'pack-menu') {
      await context.deferReply();
      try {
        refreshApiClient();
        await context.editOrReply(
          packDetailResponse(parsed.session.id, await inspectPack(value), 'overview'),
        );
      } catch (error) {
        console.error('Failed to inspect selected pack.', error);
        await context.editOrReply(
          storeErrorResponse('Não foi possível carregar este pack. Tente novamente.'),
        );
      }
      return;
    }

    const current = parsed.session.state;
    if (current.tab !== 'contratar') {
      await context.write({
        content: 'Esta opção não está disponível nesta aba.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (current.purchase.kind === 'purchasing') {
      await context.write({
        content: 'Aguarde a contratação atual terminar antes de alterar a loja.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (parsed.action.action === 'card-menu') {
      if (!current.items.some((card) => card.id === value)) {
        await context.write({
          content: 'Esta carta não está mais disponível. Atualize a loja.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const updated = await updateStorePanel(parsed.session, {
        action: 'card-menu',
        value,
      });
      if (updated.kind !== 'owned' || updated.session.state.tab !== 'contratar') {
        await context.write({
          content: 'Esta loja expirou. Use `/loja` novamente.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      try {
        await context.write({
          ...cardDetailResponse(parsed.session.id, updated.session.state),
          flags: 32768 | MessageFlags.Ephemeral,
        });
      } catch (error) {
        console.error('Failed to show selected card.', error);
        await context.write({
          content: 'Não foi possível abrir esta carta. Tente novamente.',
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if (parsed.action.action !== 'position-menu' && parsed.action.action !== 'sort-menu') {
      await context.write({
        content: 'Esta ação não está disponível na loja.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await context.deferUpdate();
    try {
      const updated = await updateStorePanel(parsed.session, {
        action: parsed.action.action,
        value,
      });
      if (updated.kind === 'stale') {
        await context.editOrReply(await storeResponse(updated.session, updated.session.state.tab));
        return;
      }
      if (updated.kind !== 'owned') throw new Error('Store session expired during filtering.');
      await context.editOrReply(await storeResponse(updated.session, 'contratar'));
    } catch (error) {
      console.error('Failed to filter store cards.', error);
      await context.editOrReply(
        storeErrorResponse(
          'Não foi possível aplicar este filtro. Use `/loja` para tentar novamente.',
        ),
      );
    }
  }
}
