import { GameRuleError } from '../../../../game-rule.js';
import type { DiscordIdentity, PackRepository, PurchaseResult } from '../pack.types.js';

export class PurchasePackUseCase {
  constructor(private readonly repository: PackRepository) {}

  execute(identity: DiscordIdentity, packId: string): Promise<PurchaseResult> {
    if (!packId) throw new Error('Pack id is required.');
    return this.repository.runPurchase(identity, packId, (transaction) => {
      if (!transaction.canBuy) throw new GameRuleError('Pack is not available for purchase.');
      if (transaction.cardCount >= transaction.maxCards)
        throw new GameRuleError('Card inventory capacity exceeded.');
      if (transaction.ownedQuantity >= transaction.limitPerUser)
        throw new GameRuleError('Pack limit reached.');
      if (transaction.balance < transaction.price) throw new GameRuleError('Insufficient balance.');
      return transaction.commit();
    });
  }
}
