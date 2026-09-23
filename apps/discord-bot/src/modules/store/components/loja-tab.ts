import { ApiClientError, inspectPack, purchasePack } from '@futhub/api-client';
import { ComponentCommand, MessageFlags } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import { refreshApiClient } from '../../../shared/command.js';
import { formatPackPurchase } from '../format.js';
import { updateStorePanel } from '../panel.js';
import { purchaseSelectedCard } from '../purchase.js';
import { packDetailResponse, storeErrorResponse, storeResponse } from '../response.js';
import type { PackDetailTab } from '../response.js';
import type { StoreSessionId } from '../session.js';
import { storeSessionManager } from '../state.js';

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

    if (
      parsed.action.action !== 'tab' &&
      parsed.action.action !== 'page' &&
      parsed.action.action !== 'favorite'
    ) {
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
        value: parsed.action.arg,
      });
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
    const outcome = await purchaseSelectedCard(
      sessionId,
      {
        id: userId,
        name: context.interaction.user.username,
        avatarUrl: context.interaction.user.avatarURL(),
      },
      cardId,
      () => context.deferUpdate(),
    );
    if (outcome.kind === 'immediate') {
      await context.write({ content: outcome.message, flags: MessageFlags.Ephemeral });
      return;
    }
    try {
      await context.editOrReply(outcome.response);
    } catch (error) {
      if (!outcome.completedBalance) throw error;
      console.error('Card was purchased, but the store response could not be updated.', error);
      await context.editOrReply(storeErrorResponse(outcome.completedBalance));
    }
  }
}
