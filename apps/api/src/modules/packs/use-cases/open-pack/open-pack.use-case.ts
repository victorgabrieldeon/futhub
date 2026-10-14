import { GameRuleError } from '../../../../game-rule.js';
import type { DiscordIdentity, OpenPackResult, PackRepository } from '../pack.types.js';
import { selectPackCards } from './select-pack-cards.js';

export class OpenPackUseCase {
  constructor(
    private readonly repository: PackRepository,
    private readonly random: () => number,
  ) {}

  async execute(identity: DiscordIdentity, packId: string): Promise<OpenPackResult> {
    if (!packId) throw new Error('Pack id is required.');
    return this.repository.runOpen(identity, packId, async (transaction) => {
      if (transaction.ownedQuantity < 1) throw new GameRuleError('User does not own this pack.');
      if (transaction.cardCount + transaction.cardsAmount > transaction.maxCards)
        throw new GameRuleError('Card inventory capacity exceeded.');
      const opened = await transaction.commit(
        selectPackCards(
          transaction.candidates,
          transaction.probabilities,
          transaction.cardsAmount,
          this.random,
        ),
      );
      return { ...opened, progression: await transaction.grantProgression() };
    });
  }
}
