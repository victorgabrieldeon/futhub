import { normalizeRedeemCode } from '../../redeem-code.js';
import type {
  Clock,
  RedeemCode,
  ResgatarCodigoInput,
  ResgatarCodigoOutput,
  ResgatarCodigoRejection,
  ResgatarCodigoRepository,
} from './resgatar-codigo.types.js';

export function rejectionFor(
  code: RedeemCode | null,
  alreadyRedeemed: boolean,
  now: Date,
): ResgatarCodigoRejection | null {
  if (!code) return 'not_found';
  if (!code.active) return 'inactive';
  if (code.expiresAt && code.expiresAt <= now) return 'expired';
  if (alreadyRedeemed) return 'already_redeemed';
  if (code.maxClaims !== null && code.claims >= code.maxClaims) return 'exhausted';
  return null;
}

export class ResgatarCodigoUseCase {
  constructor(
    private readonly repository: ResgatarCodigoRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: ResgatarCodigoInput,
    now: Date = this.clock.now(),
  ): Promise<ResgatarCodigoOutput> {
    const normalized = normalizeRedeemCode(input.code);
    if (!normalized) return { kind: 'rejected', reason: 'not_found' };
    return this.repository.run(input.identity, now, async (transaction) => {
      const code = await transaction.findCode(normalized);
      const alreadyRedeemed = code ? await transaction.hasRedeemed(code.id) : false;
      const rejection = rejectionFor(code, alreadyRedeemed, now);
      if (rejection || !code) return { kind: 'rejected', reason: rejection ?? 'not_found' };
      if (!(await transaction.canReceive(code.reward)))
        return { kind: 'rejected', reason: 'inventory_full' };
      const balance = await transaction.redeem(code);
      return { kind: 'success', code: code.code, reward: code.reward, balance };
    });
  }
}
