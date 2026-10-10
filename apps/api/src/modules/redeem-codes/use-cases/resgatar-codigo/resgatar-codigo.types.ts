export type DiscordIdentity = Readonly<{
  id: string;
  name: string;
  avatarUrl: string | null;
}>;

export type RedeemRewardType = 'card' | 'pack' | 'balance' | 'field';

export type RedeemReward = Readonly<{
  itemId: string;
  type: RedeemRewardType;
  quantity: number;
  resourceId: string | null;
  resourceName: string | null;
}>;

export type RedeemCode = Readonly<{
  id: string;
  code: string;
  active: boolean;
  expiresAt: Date | null;
  maxClaims: number | null;
  claims: number;
  reward: RedeemReward;
}>;

export type ResgatarCodigoRejection =
  | 'not_found'
  | 'inactive'
  | 'expired'
  | 'already_redeemed'
  | 'exhausted'
  | 'inventory_full';

export type ResgatarCodigoInput = Readonly<{ identity: DiscordIdentity; code: string }>;

export type ResgatarCodigoOutput =
  | Readonly<{ kind: 'success'; code: string; reward: RedeemReward; balance: number }>
  | Readonly<{ kind: 'rejected'; reason: ResgatarCodigoRejection }>;

export type ResgatarCodigoTransaction = Readonly<{
  /** Loads the code and locks it until the transaction ends. */
  findCode(code: string): Promise<RedeemCode | null>;
  hasRedeemed(redeemId: string): Promise<boolean>;
  canReceive(reward: RedeemReward): Promise<boolean>;
  /** Records the Resgate, grants the Item and returns the resulting balance. */
  redeem(code: RedeemCode): Promise<number>;
}>;

export abstract class ResgatarCodigoRepository {
  abstract run<T>(
    identity: DiscordIdentity,
    now: Date,
    operation: (transaction: ResgatarCodigoTransaction) => Promise<T>,
  ): Promise<T>;
}

export abstract class Clock {
  abstract now(): Date;
}
