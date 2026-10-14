import { type DiscordIdentityDto, executeLucro, listMissions } from '@futhub/api-client';
import { ComponentCommand } from 'seyfert';
import type { ComponentContext } from 'seyfert';

import { refreshApiClient } from '../commands/shared.js';
import { openTeamPanel } from '../commands/time.js';
import { type BotMessage, isComponentsV2 } from '../core/bot-response.js';
import { stageOf } from '../core/juice.js';
import { isNavId, parseNavId } from '../core/nav.js';
import { deliver, lucroReply, missionsReply } from '../core/replies.js';
import { EPHEMERAL, friendlyError, notice } from '../core/ui.js';
import { helpResponse } from '../features/help.js';
import { loadOwnedPacks, myPacksResponse, revealPack } from '../features/store/pack-opening.js';
import { initialPacksState, storeResponse, storeSessionManager } from '../features/store/store.js';
import { isTeamTab } from '../features/team/team-session.js';

type Context = ComponentContext<'Button'>;

export default class NavButtonComponent extends ComponentCommand {
  componentType = 'Button' as const;

  filter(context: Context): boolean {
    return isNavId(context.customId);
  }

  async run(context: Context): Promise<void> {
    const parsed = parseNavId(context.customId);
    if (!parsed) {
      await context.write(
        notice('warning', 'Botão inválido', 'Abra o painel de novo.') as BotMessage,
      );
      return;
    }
    const user = context.interaction.user;
    const player: DiscordIdentityDto = {
      id: user.id,
      name: user.username,
      avatarUrl: user.avatarURL(),
    };
    // Telas do dono são trocadas no lugar; quem clica numa mensagem alheia recebe a sua em privado.
    const own = user.id === parsed.ownerId;
    let deferred = false;
    try {
      refreshApiClient();
      switch (parsed.target) {
        case 'hub':
          deferred = await this.prepareView(context, own);
          await this.showView(context, own, (await openTeamPanel(player, !own)) as BotMessage);
          return;
        case 'ajuda':
          deferred = await this.prepareView(context, own);
          await this.showView(context, own, helpResponse(player.id, !own));
          return;
        case 'packs':
          deferred = await this.prepareView(context, own);
          await this.showView(
            context,
            own,
            await myPacksResponse(player.id, await loadOwnedPacks(player), !own),
          );
          return;
        case 'missoes':
          deferred = await this.prepareView(context, own);
          await this.showView(
            context,
            own,
            await missionsReply(player, await listMissions(player)),
          );
          return;
        case 'lucro': {
          const reply = await lucroReply(player, await executeLucro(player), new Date());
          deferred = true;
          await deliver(stageOf(context), reply);
          return;
        }
        case 'open':
          await context.deferReply();
          deferred = true;
          await revealPack(stageOf(context, true), player, parsed.arg);
          return;
        case 'loja': {
          await context.deferReply(true);
          deferred = true;
          const session = storeSessionManager.create(player.id, initialPacksState());
          await context.editOrReply(await storeResponse(session, 'packs'));
          return;
        }
        case 'time':
        case 'liga': {
          await context.deferReply(true);
          deferred = true;
          const tab =
            parsed.target === 'liga' ? 'league' : isTeamTab(parsed.arg) ? parsed.arg : 'overview';
          await context.editOrReply(await openTeamPanel(player, true, tab));
          return;
        }
      }
    } catch (error) {
      console.error(`Failed to open ${parsed.target} from a shortcut.`, error);
      const message = notice(
        'error',
        'Não foi possível abrir esta tela',
        friendlyError(error, 'Tente de novo em instantes.'),
      ) as BotMessage;
      if (deferred) await context.followup(message);
      else await context.write(message);
    }
  }

  /** Dono: confirma o clique sem mensagem nova. Outro jogador: resposta privada. */
  private async prepareView(context: Context, own: boolean): Promise<boolean> {
    if (own) await context.deferUpdate();
    else await context.deferReply(true);
    return true;
  }

  private async showView(context: Context, own: boolean, message: BotMessage): Promise<void> {
    // Mensagens Components V2 não viram texto/embeds; templates legados vão numa mensagem nova.
    if (own && !isComponentsV2(message)) {
      await context.followup({ ...message, flags: (message.flags ?? 0) | EPHEMERAL });
      return;
    }
    const flags = (message.flags ?? 0) & ~(own ? EPHEMERAL : 0);
    await context.editOrReply({ ...message, flags } as BotMessage);
  }
}
