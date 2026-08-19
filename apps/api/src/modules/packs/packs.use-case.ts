import type { DiscordIdentity, PackRepository, PurchaseResult, UserCard } from './packs.types.js';

export class PurchasePackUseCase {
  constructor(private readonly repository: PackRepository) {}

  execute(identity: DiscordIdentity, packId: string): Promise<PurchaseResult> {
    if (!packId) throw new Error('Pack id is required.');
    return this.repository.buy(identity, packId);
  }
}

export class OpenPackUseCase {
  constructor(
    private readonly repository: PackRepository,
    private readonly random: () => number,
  ) {}

  execute(identity: DiscordIdentity, packId: string): Promise<readonly UserCard[]> {
    if (!packId) throw new Error('Pack id is required.');
    return this.repository.open(identity, packId, this.random);
  }
}
