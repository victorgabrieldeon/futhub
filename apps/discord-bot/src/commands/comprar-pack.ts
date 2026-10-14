import { listPackCatalog, purchasePack } from '@futhub/api-client';
import { Declare, Options, createStringOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { packPurchaseReply } from '../core/replies.js';
import {
  CommandInputError,
  FutHubCommand,
  identity,
  refreshApiClient,
  requiredText,
} from './shared.js';

const options = {
  pack: createStringOption({
    description: 'Pack da loja.',
    required: true,
    autocomplete: async (interaction) => {
      try {
        refreshApiClient();
        const query = interaction.getInput().trim().toLocaleLowerCase('pt-BR');
        const packs = await listPackCatalog();
        await interaction.respond(
          packs
            .filter((pack) => pack.name.toLocaleLowerCase('pt-BR').includes(query))
            .slice(0, 25)
            .map((pack) => ({
              name: `${pack.name} · ${pack.price.toLocaleString('pt-BR')} moedas · ${pack.cardsAmount} ${pack.cardsAmount === 1 ? 'carta' : 'cartas'}`.slice(
                0,
                100,
              ),
              value: pack.id,
            })),
        );
      } catch (error) {
        console.error('Failed to autocomplete pack catalog.', error);
        await interaction.respond([]);
      }
    },
  }),
};

@Declare({ name: 'comprar-pack', description: 'Compre um pack da loja.' })
@Options(options)
export default class ComprarPackCommand extends FutHubCommand {
  async run(context: CommandContext<typeof options>): Promise<void> {
    await this.respond(context, 'comprar-pack', async () => {
      const player = identity(context);
      const packId = requiredText(context.options.pack, 'o pack');
      const pack = (await listPackCatalog()).find((item) => item.id === packId);
      if (!pack) throw new CommandInputError('Pack não encontrado na loja. Escolha um da lista.');
      return packPurchaseReply(player, pack, await purchasePack(packId, { identity: player }));
    });
  }
}
