import { Declare, Options, createStringOption } from 'seyfert';
import type { CommandContext } from 'seyfert';

import {
  initialHiringState,
  initialPacksState,
  loadHiringState,
  storeResponse,
  storeSessionManager,
} from '../features/store/store.js';
import { FutHubCommand } from './shared.js';

const options = {
  aba: createStringOption({
    description: 'Abrir direto em packs ou na contratação de jogadores.',
    required: false,
    choices: [
      { name: 'Packs', value: 'packs' },
      { name: 'Contratar jogadores', value: 'contratar' },
    ] as const,
  }),
};

@Declare({ name: 'loja', description: 'Compre packs ou contrate jogadores.' })
@Options(options)
export default class LojaCommand extends FutHubCommand {
  async run(context: CommandContext<typeof options>): Promise<void> {
    await this.respond(context, 'loja', async () => {
      if (context.options.aba === 'contratar') {
        const session = storeSessionManager.create(
          context.author.id,
          await loadHiringState(initialHiringState()),
        );
        return storeResponse(session, 'contratar');
      }
      const session = storeSessionManager.create(context.author.id, initialPacksState());
      return storeResponse(session, 'packs');
    });
  }
}
