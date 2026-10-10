import { purchaseCard, purchasePack } from '@futhub/api-client';
import { Declare, Options, createStringOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { botResponse, identityData } from '../bot-response.js';
import { EMOJI } from '../emojis.js';
import { cardPurchaseData, packPurchaseData } from '../response-data.js';
import { initialPacksState, storeResponse, storeSessionManager } from '../store.js';
import {
  CommandInputError,
  FutHubCommand,
  MissionReply,
  identity,
  requiredText,
} from './shared.js';

const tabs = [
  { name: 'Packs', value: 'packs' },
  { name: 'Contratar', value: 'contratar' },
] as const;
const options = {
  aba: createStringOption({ description: 'Área da loja.', required: false, choices: tabs }),
  pack_id: createStringOption({ description: 'ID do pack para comprar.', required: false }),
  carta_id: createStringOption({ description: 'ID da carta para contratar.', required: false }),
};

@Declare({ name: 'loja', description: 'Veja packs ou contrate cartas.' })
@Options(options)
export default class LojaCommand extends FutHubCommand {
  async run(context: CommandContext<typeof options>): Promise<void> {
    if (!context.options.aba) {
      await this.respond(context, 'loja', async () => {
        const session = storeSessionManager.create(context.author.id, initialPacksState());
        return storeResponse(session, 'packs');
      });
      return;
    }
    await this.respond(context, 'loja', async () => {
      const user = identity(context);
      if (context.options.aba === 'packs') {
        const packId = context.options.pack_id?.trim();
        if (!packId) return `${EMOJI.loja} Use \`!loja\` para abrir a loja.`;
        const result = await purchasePack(packId, { identity: user });
        return new MissionReply(
          await botResponse('pack.purchase', {
            ...identityData(user),
            ...packPurchaseData(packId, result),
          }),
          user,
          result.completedMissions,
        );
      }
      if (context.options.aba === 'contratar') {
        const result = await purchaseCard(
          requiredText(context.options.carta_id ?? '', 'carta_id'),
          {
            identity: user,
          },
        );
        return new MissionReply(
          await botResponse('card.purchase', {
            ...identityData(user),
            ...cardPurchaseData(result),
          }),
          user,
          result.completedMissions,
        );
      }
      throw new CommandInputError('Aba da loja inválida.');
    });
  }
}
