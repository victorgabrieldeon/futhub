import {
  type Clock,
  type CommandConfig,
  type CommandResult,
  type DiscordIdentity,
  type RandomSource,
  type ResgatarLucroRepository,
  type Reward,
  lucroCommand,
} from './resgatar-lucro.types.js';

export function selectWeightedReward(rewards: readonly Reward[], random: number): Reward {
  if (rewards.length === 0) throw new Error('Command has no rewards.');
  if (!Number.isFinite(random) || random < 0 || random >= 1)
    throw new Error('Random value must be in [0, 1).');
  const total = rewards.reduce((sum, reward) => {
    if (!Number.isInteger(reward.weight) || reward.weight <= 0)
      throw new Error('Reward weight must be positive.');
    return sum + reward.weight;
  }, 0);
  let point = random * total;
  for (const reward of rewards) {
    point -= reward.weight;
    if (point < 0) return reward;
  }
  throw new Error('Unable to select reward.');
}

export class ResgatarLucroUseCase {
  constructor(
    private readonly repository: ResgatarLucroRepository,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  execute(
    identity: DiscordIdentity,
    command: CommandConfig = lucroCommand,
    now: Date = this.clock.now(),
    random: number = this.random.next(),
  ): Promise<CommandResult> {
    return this.repository.run(command, identity, now, async (transaction, persistedCommand) => {
      const availableAt = await transaction.getAvailableAt();
      if (availableAt && now < availableAt) return { kind: 'cooldown', availableAt };
      const reward = selectWeightedReward(persistedCommand.rewards, random);
      const club = await transaction.getClub();
      const sponsorRevenue = club.sponsor.completed ? club.sponsor.payout : 0;
      const report = {
        ticketRevenue: club.stadium.ticketRevenue,
        commercialRevenue: reward.value,
        sponsorRevenue,
        maintenance: club.stadium.maintenance,
        payroll: club.payroll,
        net:
          club.stadium.ticketRevenue +
          reward.value +
          sponsorRevenue -
          club.stadium.maintenance -
          club.payroll,
      };
      const balance = await transaction.credit(report.net);
      await transaction.advanceMission();
      const progression = await transaction.grantProgression();
      const levelRewardBalance = progression.rewards.reduce(
        (total, item) => total + (item.type === 'balance' ? item.quantity : 0),
        0,
      );
      const nextAvailableAt = new Date(now.getTime() + persistedCommand.cooldownSeconds * 1000);
      await transaction.setAvailableAt(nextAvailableAt);
      return {
        kind: 'success',
        reward,
        report,
        balance: balance + levelRewardBalance,
        availableAt: nextAvailableAt,
        progression,
        embed: persistedCommand.embed ?? lucroCommand.embed,
      };
    });
  }
}
