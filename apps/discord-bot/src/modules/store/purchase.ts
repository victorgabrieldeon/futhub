import { ApiClientError, type DiscordIdentityDto, purchaseCard } from '@futhub/api-client';

import { refreshApiClient } from '../../shared/command.js';
import { cardDetailResponse, storeErrorResponse } from './response.js';
import type { StoreSessionId } from './session.js';
import { storeSessionManager } from './state.js';

export async function purchaseSelectedCard(
  sessionId: StoreSessionId,
  identity: DiscordIdentityDto,
  cardId: string,
  acknowledge: () => Promise<unknown>,
) {
  const access = storeSessionManager.get(sessionId, identity.id);
  if (
    access.kind !== 'owned' ||
    access.session.state.tab !== 'contratar' ||
    access.session.state.selection.kind !== 'selected' ||
    access.session.state.selection.cardId !== cardId
  )
    return {
      kind: 'immediate' as const,
      message: 'Esta carta não está mais selecionada. Abra os detalhes novamente.',
    };

  const state = access.session.state;
  if (state.purchase.kind !== 'idle')
    return {
      kind: 'immediate' as const,
      message:
        state.purchase.kind === 'purchased'
          ? 'Esta contratação já foi concluída.'
          : 'Esta contratação já está sendo processada.',
    };

  const pending = { ...state, purchase: { kind: 'purchasing' as const, cardId } };
  const started = storeSessionManager.replaceStateIf(sessionId, identity.id, state, pending);
  if (started.kind !== 'owned')
    return {
      kind: 'immediate' as const,
      message: 'A loja mudou. Abra os detalhes da carta e tente novamente.',
    };

  // Reserve the purchase before acknowledging so concurrent clicks cannot both reach the API.
  try {
    await acknowledge();
  } catch (error) {
    storeSessionManager.replaceStateIf(sessionId, identity.id, pending, {
      ...pending,
      purchase: { kind: 'idle' },
    });
    throw error;
  }

  let result: Awaited<ReturnType<typeof purchaseCard>>;
  try {
    refreshApiClient();
    result = await purchaseCard(cardId, { identity });
  } catch (error) {
    const restored = storeSessionManager.replaceStateIf(sessionId, identity.id, pending, {
      ...pending,
      purchase: { kind: 'idle' },
    });
    console.error('Failed to purchase card.', error);
    const notice =
      error instanceof ApiClientError && error.message.includes('Insufficient balance')
        ? '❌ Saldo insuficiente para contratar esta carta.'
        : '❌ Não foi possível contratar esta carta. Tente novamente.';
    return {
      kind: 'deferred' as const,
      response:
        restored.kind === 'owned' && restored.session.state.tab === 'contratar'
          ? cardDetailResponse(sessionId, restored.session.state, notice)
          : storeErrorResponse(notice),
      completedBalance: null,
    };
  }

  const completed = storeSessionManager.replaceStateIf(sessionId, identity.id, pending, {
    ...pending,
    purchase: { kind: 'purchased', cardId, price: result.price, balance: result.balance },
  });
  const completedNotice = `A contratação foi concluída. Saldo atual: ${result.balance.toLocaleString('pt-BR')} moedas.`;
  let response = storeErrorResponse(completedNotice);
  if (completed.kind === 'owned' && completed.session.state.tab === 'contratar') {
    try {
      response = cardDetailResponse(sessionId, completed.session.state);
    } catch (error) {
      console.error('Card was purchased, but the store response could not be rendered.', error);
    }
  }
  return {
    kind: 'deferred' as const,
    response,
    completedBalance: completedNotice,
  };
}
