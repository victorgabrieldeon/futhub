import * as api from '@futhub/api-client';
import type { InteractionReplyOptions } from 'discord.js';
import { formatPackOpen, formatPackPurchase } from './game.js';
import {
  type Action,
  type Binding,
  actionId,
  isPackId,
  noMentions,
  safeResponse,
} from './responses.js';

export type RuntimeResult = {
  message: InteractionReplyOptions;
  fallback: string;
  followUp?: InteractionReplyOptions;
};
export function createRuntime(client = api) {
  async function template(key: string) {
    try {
      return await client.getBotResponse(key);
    } catch {
      return undefined;
    }
  }
  return {
    async error(
      userName: string,
      userId: string,
      commandName: string,
      cause?: unknown,
    ): Promise<InteractionReplyOptions> {
      let error =
        'Nao foi possivel confirmar o resultado. Confira seu saldo e inventario antes de repetir.';
      const pack = [
        'loja',
        'inspecionar-pack',
        'comprar-pack',
        'abrir-pack',
        'pack.shop',
        'pack.inspect',
        'pack.purchase',
        'pack.open',
      ].includes(commandName);
      if (pack && cause instanceof api.ApiClientError) {
        if (cause.status === 404) error = 'Pack nao encontrado ou indisponivel.';
        else if ([400, 409, 422].includes(cause.status))
          error = 'Operacao de pack recusada. Confira disponibilidade, saldo e inventario.';
      }
      return safeResponse(
        pack ? await template('pack.error') : undefined,
        { error, userName },
        { userId },
        error,
      );
    },
    async execute(
      action: Action,
      identity: api.DiscordIdentityDto,
      binding: Binding,
      now: Date,
    ): Promise<RuntimeResult> {
      if (
        !['lucro.claim', 'pack.shop', 'pack.inspect', 'pack.purchase', 'pack.open'].includes(
          action,
        ) ||
        binding.userId !== identity.id
      )
        throw new Error('Invalid action');
      if (action !== 'lucro.claim' && action !== 'pack.shop' && !isPackId(binding.packId ?? ''))
        throw new Error('Invalid pack ID');
      const userName = identity.name;
      if (action === 'lucro.claim') {
        const [success, cooldown] = await Promise.all([
          template('lucro.success'),
          template('lucro.cooldown'),
        ]);
        const result = await client.executeLucro(identity);
        const timestamp = Date.parse(result.availableAt);
        const availableAt = Number.isFinite(timestamp)
          ? `<t:${Math.floor(timestamp / 1000)}:F>`
          : result.availableAt;
        const remaining = String(Math.max(0, Math.ceil((timestamp - now.getTime()) / 1000)));
        const values = { userName, availableAt, remaining };
        if (result.kind === 'cooldown') {
          const fallback = `Aguarde ${remaining}s. Lucro disponivel em ${availableAt}.`;
          return { message: safeResponse(cooldown, values, binding, fallback), fallback };
        }
        const fallback = `Lucro recebido: ${result.reward.value}. Saldo: ${result.balance}. XP: +${result.progression.gainedXp}. Nivel: ${result.progression.level}.`;
        return {
          message: safeResponse(
            success,
            {
              ...values,
              message: result.reward.message,
              reward: String(result.reward.value),
              balance: String(result.balance),
              xp: String(result.progression.gainedXp),
              nextLevelXp: String(result.progression.nextLevelXp),
              level: String(result.progression.level),
            },
            binding,
            fallback,
          ),
          fallback,
        };
      }
      if (action === 'pack.shop') {
        const response = await template('pack.shop');
        const shop = await client.getPackShop({ page: binding.page ?? 1 });
        if (
          shop.packs.length > 5 ||
          !Number.isSafeInteger(shop.page) ||
          shop.page < 1 ||
          !Number.isSafeInteger(shop.totalPages) ||
          shop.totalPages < 0
        )
          throw new Error('Invalid shop');
        const packs =
          shop.packs.map((pack) => `${pack.name} | ${pack.price} | ${pack.id}`).join('\n') ||
          'Nenhum pack disponivel.';
        const fallback = `Loja (${shop.page}/${shop.totalPages})\n${packs}`.slice(0, 2000);
        const buttons = shop.packs.map((pack) => ({
          type: 2 as const,
          style: 2 as const,
          label: pack.name.slice(0, 80) || 'Inspecionar',
          custom_id: actionId('pack.inspect', { userId: identity.id, packId: pack.id }),
        }));
        const navigation = [];
        if (shop.page > 1)
          navigation.push({
            type: 2 as const,
            style: 2 as const,
            label: 'Anterior',
            custom_id: actionId('pack.shop', { userId: identity.id, page: shop.page - 1 }),
          });
        if (shop.page < shop.totalPages)
          navigation.push({
            type: 2 as const,
            style: 2 as const,
            label: 'Proxima',
            custom_id: actionId('pack.shop', { userId: identity.id, page: shop.page + 1 }),
          });
        const components = [buttons, navigation]
          .filter((row) => row.length)
          .map((row) => ({ type: 1 as const, components: row }));
        return {
          message: safeResponse(
            response,
            { packs, page: String(shop.page), totalPages: String(shop.totalPages), userName },
            { userId: identity.id, page: shop.page },
            fallback,
          ),
          fallback,
          followUp: components.length
            ? { content: 'Navegar na loja:', components, allowedMentions: noMentions }
            : undefined,
        };
      }
      const packId = binding.packId ?? '';
      if (action === 'pack.inspect') {
        const response = await template('pack.inspect');
        const pack = await client.inspectPack(packId);
        const fallback =
          `${pack.name}\nPreco: ${pack.price}. Cartas: ${pack.cardsPerPack}.\nID: ${pack.id}`.slice(
            0,
            2000,
          );
        return {
          message: safeResponse(
            response,
            {
              packId: pack.id,
              packName: pack.name,
              price: String(pack.price),
              imageUrl: pack.imageUrl,
              cardsPerPack: String(pack.cardsPerPack),
              userName,
            },
            binding,
            fallback,
          ),
          fallback,
        };
      }
      const response = await template(action);
      if (action === 'pack.purchase') {
        const result = await client.purchasePack(packId, { identity });
        const fallback = formatPackPurchase(result);
        return {
          message: safeResponse(
            response,
            {
              packId,
              balance: String(result.balance),
              quantity: String(result.quantity),
              userName,
            },
            binding,
            fallback,
          ),
          fallback,
        };
      }
      const result = await client.openPack(packId, { identity });
      const fallback = formatPackOpen(result);
      return {
        message: safeResponse(
          response,
          {
            packId,
            cards: result.cards.map(({ id, card }) => `${id}: OVR ${card.overall}`).join('\n'),
            xp: String(result.progression.gainedXp),
            level: String(result.progression.level),
            nextLevelXp: String(result.progression.nextLevelXp),
            userName,
          },
          binding,
          fallback,
        ),
        fallback,
      };
    },
  };
}
