import { ApiClientError, inspectPack, purchaseCard, purchasePack } from '@futhub/api-client';
import { ComponentCommand, MessageFlags } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import { formatPackPurchase } from '../game.js';
import {
  cardDetailResponse,
  loadHiringState,
  packDetailResponse,
  storeErrorResponse,
  storeResponse,
  storeSessionManager,
  toggleFavoritePack,
  withStorePage,
  withStoreTab,
} from '../store.js';
import type { PackDetailTab } from '../store.js';
import type { StoreSessionId } from '../store-session.js';
import { refreshApiClient } from '../commands/shared.js';

export default class LojaTabComponent extends ComponentCommand {
  componentType = 'Button' as const;

  filter(context: ComponentContext<'Button'>): boolean {
    return context.customId.startsWith('ls1:');
  }

  async run(context: ComponentContext<'Button'>): Promise<void> {
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
    if (parsed.action.action === 'inspect-pack') {
      await this.inspect(context, parsed.session.id, parsed.action.arg, 'overview', false);
      return;
    }
    if (parsed.action.action === 'detail-overview' || parsed.action.action === 'detail-config') {
      await this.inspect(
        context,
        parsed.session.id,
        parsed.action.arg,
        parsed.action.action === 'detail-overview' ? 'overview' : 'config',
        true,
      );
      return;
    }
    if (parsed.action.action === 'purchase-pack') {
      await this.purchasePack(context, parsed.action.arg);
      return;
    }
    if (parsed.action.action === 'buy') {
      await this.purchaseCard(context, parsed.session.id, userId, parsed.action.arg);
      return;
    }

    if (
      parsed.session.state.tab === 'contratar' &&
      parsed.session.state.purchase.kind === 'purchasing'
    ) {
      await context.write({
        content: 'Aguarde a contratação atual terminar antes de navegar na loja.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!['tab', 'page', 'favorite'].includes(parsed.action.action)) {
      await context.write({
        content: 'Esta ação não está disponível na loja.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await context.deferUpdate();
    try {
      refreshApiClient();
      let state = parsed.session.state;
      if (parsed.action.action === 'tab') {
        state = withStoreTab(state, parsed.action.arg);
        if (state.tab === 'contratar') state = await loadHiringState(state);
      } else if (parsed.action.action === 'page') {
        const page = Number(parsed.action.arg);
        state =
          state.tab === 'contratar'
            ? await loadHiringState(state, { page })
            : withStorePage(state, page);
      } else if (parsed.action.action === 'favorite') {
        state = toggleFavoritePack(state, parsed.action.arg);
      } else {
        throw new Error('Unsupported store navigation action.');
      }
      const updated = storeSessionManager.replaceStateIf(
        parsed.session.id,
        userId,
        parsed.session.state,
        state,
      );
      if (updated.kind === 'stale') {
        await context.editOrReply(await storeResponse(updated.session, updated.session.state.tab));
        return;
      }
      if (updated.kind !== 'owned') {
        await context.editOrReply(storeErrorResponse('Esta loja expirou. Use `/loja` novamente.'));
        return;
      }
      await context.editOrReply(await storeResponse(updated.session, updated.session.state.tab));
    } catch (error) {
      console.error('Failed to update store.', error);
      await context.editOrReply(
        storeErrorResponse('Não foi possível atualizar a loja. Use `/loja` para tentar novamente.'),
      );
    }
  }

  private async inspect(
    context: ComponentContext<'Button'>,
    sessionId: StoreSessionId,
    packId: string,
    tab: PackDetailTab,
    update: boolean,
  ): Promise<void> {
    if (update) await context.deferUpdate();
    else await context.deferReply();
    try {
      refreshApiClient();
      const response = packDetailResponse(sessionId, await inspectPack(packId), tab);
      await context.editOrReply(response);
    } catch (error) {
      console.error('Failed to inspect pack.', error);
      await context.editOrReply(
        storeErrorResponse('Não foi possível carregar este pack. Tente novamente.'),
      );
    }
  }

  private async purchasePack(context: ComponentContext<'Button'>, packId: string): Promise<void> {
    try {
      refreshApiClient();
      const result = await purchasePack(packId, {
        identity: {
          id: context.interaction.user.id,
          name: context.interaction.user.username,
          avatarUrl: context.interaction.user.avatarURL(),
        },
      });
      await context.write({ content: formatPackPurchase(result), flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error('Failed to purchase pack.', error);
      await context.write({
        content:
          error instanceof ApiClientError && error.message.includes('Insufficient balance')
            ? 'Saldo insuficiente para comprar este pack.'
            : 'Não foi possível comprar este pack. Tente novamente.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async purchaseCard(
    context: ComponentContext<'Button'>,
    sessionId: StoreSessionId,
    userId: string,
    cardId: string,
  ): Promise<void> {
    const access = storeSessionManager.get(sessionId, userId);
    if (
      access.kind !== 'owned' ||
      access.session.state.tab !== 'contratar' ||
      access.session.state.selection.kind !== 'selected' ||
      access.session.state.selection.cardId !== cardId
    ) {
      await context.write({
        content: 'Esta carta não está mais selecionada. Abra os detalhes novamente.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const state = access.session.state;
    if (state.purchase.kind !== 'idle') {
      await context.write({
        content:
          state.purchase.kind === 'purchased'
            ? 'Esta contratação já foi concluída.'
            : 'Esta contratação já está sendo processada.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const pending = { ...state, purchase: { kind: 'purchasing' as const, cardId } };
    const started = storeSessionManager.replaceStateIf(sessionId, userId, state, pending);
    if (started.kind !== 'owned') {
      await context.write({
        content: 'A loja mudou. Abra os detalhes da carta e tente novamente.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await context.deferUpdate();
    } catch (error) {
      storeSessionManager.replaceStateIf(sessionId, userId, pending, {
        ...pending,
        purchase: { kind: 'idle' },
      });
      throw error;
    }

    let result: Awaited<ReturnType<typeof purchaseCard>>;
    try {
      refreshApiClient();
      result = await purchaseCard(cardId, {
        identity: {
          id: userId,
          name: context.interaction.user.username,
          avatarUrl: context.interaction.user.avatarURL(),
        },
      });
    } catch (error) {
      const idle = { ...pending, purchase: { kind: 'idle' as const } };
      const restored = storeSessionManager.replaceStateIf(sessionId, userId, pending, idle);
      console.error('Failed to purchase card.', error);
      const notice =
        error instanceof ApiClientError && error.message.includes('Insufficient balance')
          ? '❌ Saldo insuficiente para contratar esta carta.'
          : '❌ Não foi possível contratar esta carta. Tente novamente.';
      await context.editOrReply(
        restored.kind === 'owned' && restored.session.state.tab === 'contratar'
          ? cardDetailResponse(sessionId, restored.session.state, notice)
          : storeErrorResponse(notice),
      );
      return;
    }

    const purchased = {
      ...pending,
      purchase: {
        kind: 'purchased' as const,
        cardId,
        price: result.price,
        balance: result.balance,
      },
    };
    const completed = storeSessionManager.replaceStateIf(sessionId, userId, pending, purchased);
    if (completed.kind !== 'owned' || completed.session.state.tab !== 'contratar') {
      await context.editOrReply(
        storeErrorResponse(
          `A contratação foi concluída. Saldo atual: ${result.balance.toLocaleString('pt-BR')} moedas.`,
        ),
      );
      return;
    }
    try {
      await context.editOrReply(cardDetailResponse(sessionId, completed.session.state));
    } catch (error) {
      console.error('Card was purchased, but the store response could not be updated.', error);
      await context.editOrReply(
        storeErrorResponse(
          `A contratação foi concluída. Saldo atual: ${result.balance.toLocaleString('pt-BR')} moedas.`,
        ),
      );
    }
  }
}
