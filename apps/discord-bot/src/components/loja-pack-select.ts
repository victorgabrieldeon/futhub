import { inspectPack } from '@futhub/api-client';
import { ComponentCommand, MessageFlags } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import { refreshApiClient } from '../commands/shared.js';
import type { BotMessage } from '../core/bot-response.js';
import { friendlyError, notice, sessionNotice } from '../core/ui.js';
import {
  cardDetailResponse,
  isCardPosition,
  loadHiringState,
  packDetailResponse,
  storeResponse,
  storeSessionManager,
  withHiringFilter,
  withHiringSelection,
} from '../features/store/store.js';

const sorts = ['recent', 'overall', 'name'] as const;

function isCardSort(value: string): value is (typeof sorts)[number] {
  return sorts.some((sort) => sort === value);
}

const say = (...args: Parameters<typeof notice>) => notice(...args) as BotMessage;

export default class LojaPackSelectComponent extends ComponentCommand {
  componentType = 'StringSelect' as const;

  filter(context: ComponentContext<'StringSelect'>): boolean {
    return context.customId.startsWith('ls1:');
  }

  async run(context: ComponentContext<'StringSelect'>): Promise<void> {
    const userId = context.interaction.user.id;
    const parsed = storeSessionManager.parse(context.customId, userId);
    if (parsed.kind === 'foreign' || parsed.kind === 'expired') {
      await context.write(sessionNotice(parsed.kind, 'loja') as BotMessage);
      return;
    }
    if (parsed.kind !== 'owned') {
      await context.write(say('warning', 'Opção inválida', 'Abra a loja de novo com /loja.'));
      return;
    }

    const value = context.interaction.values[0];
    if (!value) {
      await context.write(say('warning', 'Selecione uma opção.'));
      return;
    }

    if (parsed.action.action === 'pack-menu') {
      await context.deferUpdate();
      try {
        refreshApiClient();
        await context.editOrReply(
          await packDetailResponse(parsed.session.id, await inspectPack(value)),
        );
      } catch (error) {
        console.error('Failed to inspect selected pack.', error);
        await context.followup(
          say(
            'error',
            'Não foi possível abrir este pack',
            friendlyError(error, 'Tente novamente.'),
          ),
        );
      }
      return;
    }

    const current = parsed.session.state;
    if (current.tab !== 'contratar') {
      await context.write(say('warning', 'Esta opção não está disponível nesta aba.'));
      return;
    }
    if (current.purchase.kind === 'purchasing') {
      await context.write(say('info', 'Contratação em andamento', 'Aguarde ela terminar.'));
      return;
    }
    if (parsed.action.action === 'card-menu') {
      const state = withHiringSelection(current, value);
      if (state.selection.kind !== 'selected' || state.selection.cardId !== value) {
        await context.write(
          say('warning', 'Jogador indisponível', 'Ele saiu do mercado. Atualize a loja.'),
        );
        return;
      }
      const updated = storeSessionManager.replaceStateIf(parsed.session.id, userId, current, state);
      if (updated.kind !== 'owned' || updated.session.state.tab !== 'contratar') {
        await context.write(sessionNotice('expired', 'loja') as BotMessage);
        return;
      }
      await context.write({
        ...(await cardDetailResponse(parsed.session.id, updated.session.state)),
        flags: 32768 | MessageFlags.Ephemeral,
      });
      return;
    }

    let filters = current.filters;
    if (parsed.action.action === 'position-menu') {
      if (value !== 'all' && !isCardPosition(value)) {
        await context.write(say('warning', 'Posição inválida.'));
        return;
      }
      filters = withHiringFilter(current, { position: value === 'all' ? null : value });
    } else if (parsed.action.action === 'sort-menu') {
      if (!isCardSort(value)) {
        await context.write(say('warning', 'Ordem inválida.'));
        return;
      }
      filters = withHiringFilter(current, { sort: value });
    } else {
      await context.write(say('warning', 'Esta ação não está disponível na loja.'));
      return;
    }
    await context.deferUpdate();
    try {
      refreshApiClient();
      const state = await loadHiringState(current, { page: 1, filters });
      const updated = storeSessionManager.replaceStateIf(parsed.session.id, userId, current, state);
      if (updated.kind === 'stale') {
        await context.editOrReply(await storeResponse(updated.session, updated.session.state.tab));
        return;
      }
      if (updated.kind !== 'owned') {
        await context.followup(sessionNotice('expired', 'loja') as BotMessage);
        return;
      }
      await context.editOrReply(await storeResponse(updated.session, 'contratar'));
    } catch (error) {
      console.error('Failed to filter store cards.', error);
      await context.followup(
        say('error', 'Não foi possível filtrar', friendlyError(error, 'Tente novamente.')),
      );
    }
  }
}
