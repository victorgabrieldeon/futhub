import { inspectPack, purchaseCard, purchasePack } from '@futhub/api-client';
import { ComponentCommand, MessageFlags } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import { hireImage } from '../art/scenes.js';
import { refreshApiClient } from '../commands/shared.js';
import {
  type BotMessage,
  botResponse,
  identityData,
  isComponentsV2,
  withActions,
  withHero,
} from '../core/bot-response.js';
import { sendMissionNotice } from '../core/mission-notice.js';
import { navButton } from '../core/nav.js';
import { packPurchaseReply } from '../core/replies.js';
import { cardPurchaseData } from '../core/response-data.js';
import { EPHEMERAL, friendlyError, notice, row, sessionNotice } from '../core/ui.js';
import type { StoreSessionId } from '../features/store/store-session.js';
import {
  cardDetailResponse,
  loadHiringState,
  storeResponse,
  storeSessionManager,
  toggleFavoritePack,
  withStorePage,
  withStoreTab,
} from '../features/store/store.js';

type Context = ComponentContext<'Button'>;

const say = (...args: Parameters<typeof notice>) => notice(...args) as BotMessage;
const privately = (message: BotMessage): BotMessage => ({
  ...message,
  flags: (message.flags ?? 0) | MessageFlags.Ephemeral,
});

function player(context: Context) {
  const user = context.interaction.user;
  return { id: user.id, name: user.username, avatarUrl: user.avatarURL() };
}

export default class LojaTabComponent extends ComponentCommand {
  componentType = 'Button' as const;

  filter(context: Context): boolean {
    return context.customId.startsWith('ls1:');
  }

  async run(context: Context): Promise<void> {
    const userId = context.interaction.user.id;
    const parsed = storeSessionManager.parse(context.customId, userId);
    if (parsed.kind === 'foreign' || parsed.kind === 'expired') {
      await context.write(sessionNotice(parsed.kind, 'loja') as BotMessage);
      return;
    }
    if (parsed.kind !== 'owned') {
      await context.write(say('warning', 'Botão inválido', 'Abra a loja de novo com /loja.'));
      return;
    }
    const { action } = parsed;
    if (action.action === 'purchase-pack') {
      await this.purchasePack(context, action.arg);
      return;
    }
    if (action.action === 'buy') {
      await this.purchaseCard(context, parsed.session.id, userId, action.arg);
      return;
    }
    if (
      parsed.session.state.tab === 'contratar' &&
      parsed.session.state.purchase.kind === 'purchasing'
    ) {
      await context.write(say('info', 'Contratação em andamento', 'Aguarde ela terminar.'));
      return;
    }
    if (!['tab', 'page', 'favorite', 'back'].includes(action.action)) {
      await context.write(say('warning', 'Esta ação não está disponível na loja.'));
      return;
    }

    await context.deferUpdate();
    try {
      refreshApiClient();
      let state = parsed.session.state;
      if (action.action === 'tab') {
        state = withStoreTab(state, action.arg);
        if (state.tab === 'contratar' && state !== parsed.session.state)
          state = await loadHiringState(state);
      } else if (action.action === 'page') {
        const page = Number(action.arg);
        state =
          state.tab === 'contratar'
            ? await loadHiringState(state, { page })
            : withStorePage(state, page);
      } else if (action.action === 'favorite') {
        state = toggleFavoritePack(state, action.arg);
      }
      const updated = storeSessionManager.replaceStateIf(
        parsed.session.id,
        userId,
        parsed.session.state,
        state,
      );
      if (updated.kind === 'stale' || updated.kind === 'owned') {
        await context.editOrReply(await storeResponse(updated.session, updated.session.state.tab));
        return;
      }
      await context.followup(sessionNotice('expired', 'loja') as BotMessage);
    } catch (error) {
      console.error('Failed to update store.', error);
      await context.followup(
        say('error', 'Não foi possível atualizar a loja', friendlyError(error, 'Tente novamente.')),
      );
    }
  }

  private async purchasePack(context: Context, packId: string): Promise<void> {
    await context.deferReply(true);
    try {
      refreshApiClient();
      const user = player(context);
      const pack = await inspectPack(packId);
      const reply = await packPurchaseReply(
        user,
        { ...pack, cardsAmount: pack.cardsPerPack, imageUrl: pack.imageUrl || null },
        await purchasePack(packId, { identity: user }),
      );
      await context.editOrReply(privately(reply.message));
      await reply.afterSend((notice) => context.followup(privately(notice)));
    } catch (error) {
      console.error('Failed to purchase pack.', error);
      await context.editOrReply(
        say(
          'error',
          'Compra não concluída',
          friendlyError(error, 'Confira seu saldo e o limite deste pack por jogador.'),
          'Nenhuma moeda foi descontada se a compra falhou.',
        ),
      );
    }
  }

  private async purchaseCard(
    context: Context,
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
      await context.write(
        say('warning', 'Jogador não selecionado', 'Escolha o jogador no menu da loja de novo.'),
      );
      return;
    }
    const state = access.session.state;
    if (state.purchase.kind !== 'idle') {
      await context.write(
        state.purchase.kind === 'purchased'
          ? say('success', 'Este jogador já foi contratado.')
          : say('info', 'Contratação em andamento', 'Aguarde ela terminar.'),
      );
      return;
    }
    const pending = { ...state, purchase: { kind: 'purchasing' as const, cardId } };
    const started = storeSessionManager.replaceStateIf(sessionId, userId, state, pending);
    if (started.kind !== 'owned') {
      await context.write(say('warning', 'A loja mudou', 'Escolha o jogador de novo.'));
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

    const user = player(context);
    let result: Awaited<ReturnType<typeof purchaseCard>>;
    try {
      refreshApiClient();
      result = await purchaseCard(cardId, { identity: user });
    } catch (error) {
      const idle = { ...pending, purchase: { kind: 'idle' as const } };
      const restored = storeSessionManager.replaceStateIf(sessionId, userId, pending, idle);
      console.error('Failed to purchase card.', error);
      const reason = friendlyError(error, 'Não foi possível contratar este jogador.');
      if (restored.kind === 'owned' && restored.session.state.tab === 'contratar')
        await context.editOrReply(
          await cardDetailResponse(sessionId, restored.session.state, `> ${reason}`),
        );
      else await context.followup(say('error', 'Contratação não concluída', reason));
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
    storeSessionManager.replaceStateIf(sessionId, userId, pending, purchased);
    const card = state.items.find(({ id }) => id === cardId);
    try {
      const face = card ?? { name: 'Jogador', overall: 0, position: '', imageUrl: null };
      const message = withActions(
        withHero(
          await botResponse('card.purchase', {
            ...identityData(user),
            ...cardPurchaseData(face, result),
          }),
          {
            name: 'contratacao.png',
            data: await hireImage(face, result.price, result.balance),
            description: `${face.name} contratado`,
          },
        ),
        [
          row(
            navButton('time', userId, { arg: 'inventory', label: 'Ver elenco', emoji: 'elenco' }),
            navButton('time', userId, { arg: 'lineup', label: 'Escalar', emoji: 'escalacao' }),
          ),
        ],
      );
      if (isComponentsV2(message))
        await context.editOrReply({ ...message, flags: (message.flags ?? 0) & ~EPHEMERAL });
      else {
        await context.editOrReply(await cardDetailResponse(sessionId, purchased));
        await context.followup(privately(message));
      }
    } catch (error) {
      console.error('Card was purchased, but the reply could not be rendered.', error);
      await context.editOrReply(await cardDetailResponse(sessionId, purchased));
    }
    await sendMissionNotice(
      (notice) => context.followup(privately(notice)),
      user,
      result.completedMissions,
    );
  }
}
