import { inspectPack } from '@futhub/api-client';
import { ComponentCommand, MessageFlags } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import { refreshApiClient } from '../commands/shared.js';
import {
  cardDetailResponse,
  isCardPosition,
  loadHiringState,
  packDetailResponse,
  storeErrorResponse,
  storeResponse,
  storeSessionManager,
  withHiringFilter,
  withHiringSelection,
} from '../store.js';

const sorts = ['recent', 'overall', 'name'] as const;

function isCardSort(value: string): value is (typeof sorts)[number] {
  return sorts.some((sort) => sort === value);
}

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
      const state = withHiringSelection(current, value);
      if (state.selection.kind !== 'selected' || state.selection.cardId !== value) {
        await context.write({
          content: 'Esta carta não está mais disponível. Atualize a loja.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const updated = storeSessionManager.replaceStateIf(parsed.session.id, userId, current, state);
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

    try {
      let filters = current.filters;
      if (parsed.action.action === 'position-menu') {
        if (value !== 'all' && !isCardPosition(value)) throw new Error('Invalid card position.');
        filters = withHiringFilter(current, { position: value === 'all' ? null : value });
      } else if (parsed.action.action === 'sort-menu') {
        if (!isCardSort(value)) throw new Error('Invalid card sort.');
        filters = withHiringFilter(current, { sort: value });
      } else {
        await context.write({
          content: 'Esta ação não está disponível na loja.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await context.deferUpdate();
      refreshApiClient();
      const state = await loadHiringState(current, { page: 1, filters });
      const updated = storeSessionManager.replaceStateIf(parsed.session.id, userId, current, state);
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
