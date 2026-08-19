import { selectPackCards } from './use-cases/open-pack/select-pack-cards.js';
import type { DiscordIdentity, PackRepository, PurchaseResult, UserCard } from './packs.types.js';

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
  execute(identity: DiscordIdentity, packId: string): Promise<readonly UserCard[]> {
    if (!packId) throw new Error('Pack id is required.');
    return this.repository.runOpen(identity, packId, (transaction) => {
      if (transaction.ownedQuantity < 1) throw new Error('User does not own this pack.');
      if (transaction.cardCount + transaction.cardsAmount > transaction.maxCards)
        throw new Error('Card inventory capacity exceeded.');
      return transaction.commit(
        selectPackCards(
          transaction.candidates,
          transaction.probabilities,
          transaction.cardsAmount,
          this.random,
        ),
      );
    });
  }
}
