import type {
  DiscordIdentity,
  OpenPackResult,
  PackRepository,
  PurchaseResult,
} from './packs.types.js';
import { selectPackCards } from './use-cases/open-pack/select-pack-cards.js';

export class PurchasePackUseCase {
  constructor(private readonly repository: PackRepository) {}
  execute(identity: DiscordIdentity, packId: string): Promise<PurchaseResult> {
    if (!packId) throw new Error('Pack id is required.');
    return this.repository.runPurchase(identity, packId, (transaction) => {
      if (!transaction.canBuy) throw new Error('Pack is not available for purchase.');
      if (transaction.cardCount >= transaction.maxCards)
        throw new Error('Card inventory capacity exceeded.');
      if (transaction.ownedQuantity >= transaction.limitPerUser)
        throw new Error('Pack limit reached.');
      if (transaction.balance < transaction.price) throw new Error('Insufficient balance.');
      return transaction.commit();
    });
  }
}
export class OpenPackUseCase {
  constructor(
    private readonly repository: PackRepository,
    private readonly random: () => number,
  ) {}
  async execute(identity: DiscordIdentity, packId: string): Promise<OpenPackResult> {
    if (!packId) throw new Error('Pack id is required.');
    return this.repository.runOpen(identity, packId, async (transaction) => {
      if (transaction.ownedQuantity < 1) throw new Error('User does not own this pack.');
      if (transaction.cardCount + transaction.cardsAmount > transaction.maxCards)
        throw new Error('Card inventory capacity exceeded.');
      const cards = await transaction.commit(
        selectPackCards(
          transaction.candidates,
          transaction.probabilities,
          transaction.cardsAmount,
          this.random,
        ),
      );
      return { cards, progression: await transaction.grantProgression() };
    });
  }
}
