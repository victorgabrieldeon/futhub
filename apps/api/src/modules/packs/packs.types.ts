export type DiscordIdentity = Readonly<{ id: string; name: string; avatarUrl: string | null }>;
export type PackCard = Readonly<{ id: string; overall: number }>;
export type UserCard = Readonly<{ id: string; card: PackCard }>;
export type PurchaseResult = Readonly<{ balance: number; quantity: number }>;

export abstract class PackRepository {
  abstract buy(identity: DiscordIdentity, packId: string): Promise<PurchaseResult>;
  abstract open(
    identity: DiscordIdentity,
    packId: string,
    random: () => number,
  ): Promise<readonly UserCard[]>;
}
