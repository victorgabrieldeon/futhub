import type { DiscordIdentity, PackRepository, PurchaseResult } from '../pack.types.js';

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
