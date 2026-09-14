import { purchaseCard, purchasePack } from '@futhub/api-client';
import { Declare, Options, createStringOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { formatCardPurchase, formatPackPurchase } from '../game.js';
import { CommandInputError, FutHubCommand, identity, requiredText } from './shared.js';
import { storeResponse } from '../store.js';

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
      await context.write(await storeResponse('packs'));
      return;
    }
    await this.respond(context, 'loja', async () => {
      if (context.options.aba === 'packs') {
        const packId = context.options.pack_id?.trim();
        return packId
          ? formatPackPurchase(await purchasePack(packId, { identity: identity(context) }))
          : 'Use `!loja` para abrir a loja.';
      }
      if (context.options.aba === 'contratar') {
        return formatCardPurchase(
          await purchaseCard(requiredText(context.options.carta_id ?? '', 'carta_id'), {
            identity: identity(context),
          }),
        );
      }
      throw new CommandInputError('Aba da loja inválida.');
    });
  }
}
