import { Declare, Options, createStringOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import { stageOf } from '../core/juice.js';
import { loadOwnedPacks, myPacksResponse, revealPack } from '../features/store/pack-opening.js';
import { FutHubCommand, commandError, identity, refreshApiClient } from './shared.js';

const options = {
  pack: createStringOption({
    description: 'Pack do seu inventário. Sem escolher, mostra todos os seus packs.',
    required: false,
    autocomplete: async (interaction) => {
      try {
        refreshApiClient();
        const query = interaction.getInput().trim().toLocaleLowerCase('pt-BR');
        const packs = await loadOwnedPacks({
          id: interaction.user.id,
          name: interaction.user.username,
          avatarUrl: interaction.user.avatarURL(),
        });
        await interaction.respond(
          packs
            .filter((pack) => pack.quantity > 0)
            .filter((pack) => pack.name.toLocaleLowerCase('pt-BR').includes(query))
            .slice(0, 25)
            .map((pack) => ({
              name: `${pack.name} · ${pack.quantity}×`.slice(0, 100),
              value: pack.id,
            })),
        );
      } catch (error) {
        console.error('Failed to autocomplete owned packs.', error);
        await interaction.respond([]);
      }
    },
  }),
};

@Declare({ name: 'abrir-pack', description: 'Abra um pack do seu inventário.' })
@Options(options)
export default class AbrirPackCommand extends FutHubCommand {
  async run(context: CommandContext<typeof options>): Promise<void> {
    const packId = context.options.pack?.trim();
    const player = identity(context);
    if (!packId) {
      await this.respond(context, 'abrir-pack', async () =>
        myPacksResponse(player.id, await loadOwnedPacks(player)),
      );
      return;
    }
    try {
      refreshApiClient();
      if (context.interaction) await context.deferReply();
      await revealPack(stageOf(context, Boolean(context.interaction)), player, packId);
    } catch (error) {
      await context.editOrReply(commandError('abrir-pack', error));
    }
  }
}
