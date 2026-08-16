import { Inject, Injectable } from '@nestjs/common';

import { ResgatarLucroRepository } from '../../repository/resgatar-lucro.repository.js';
import {
  Clock,
  type CommandConfig,
  type CommandResult,
  type DiscordIdentity,
  lucroCommand,
  RandomSource,
  type Reward,
} from './resgatar-lucro.types.js';

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

@Injectable()
export class SystemRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}

@Injectable()
export class ResgatarLucroUseCase {
  constructor(
    @Inject(ResgatarLucroRepository)
    private readonly repository: ResgatarLucroRepository,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(RandomSource) private readonly random: RandomSource,
  ) {}

  selectWeightedReward(rewards: readonly Reward[], random: number): Reward {
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

  execute(
    identity: DiscordIdentity,
    command: CommandConfig = lucroCommand,
    now: Date = this.clock.now(),
    random: number = this.random.next(),
  ): Promise<CommandResult> {
    return this.repository.run(command, identity, now, async (transaction, persistedCommand) => {
      const availableAt = await transaction.getAvailableAt();
      if (availableAt && now < availableAt) return { kind: 'cooldown', availableAt };
      const reward = this.selectWeightedReward(persistedCommand.rewards, random);
      const balance = await transaction.credit(reward.value);
      const nextAvailableAt = new Date(now.getTime() + persistedCommand.cooldownSeconds * 1000);
      await transaction.setAvailableAt(nextAvailableAt);
      return { kind: 'success', reward, balance, availableAt: nextAvailableAt };
    });
  }
}
