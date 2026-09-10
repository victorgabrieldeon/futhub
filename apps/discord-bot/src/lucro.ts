import type { LucroResponse } from '@futhub/api-client';
import type { InteractionReplyOptions } from 'discord.js';
import { expand } from './responses.js';

function render(template: string, values: Record<string, string>): string {
  return expand(template, values);
}

export function formatCommandResult(result: LucroResponse, now: Date): InteractionReplyOptions {
  const availableAt = new Date(result.availableAt);
  if (!Number.isFinite(availableAt.getTime())) throw new Error('API returned an invalid date.');
  const available = `<t:${Math.floor(availableAt.getTime() / 1000)}:F>`;
  if (result.kind === 'cooldown') {
    const remaining = Math.max(0, Math.ceil((availableAt.getTime() - now.getTime()) / 1000));
    return { content: `Aguarde ${remaining}s. Lucro disponível em ${available}.` };
  }
  const values = {
    message: result.reward.message,
    reward: String(result.reward.value),
    balance: String(result.balance),
    xp: String(result.progression.gainedXp),
    nextLevelXp: String(result.progression.nextLevelXp),
    level: String(result.progression.level),
    availableAt: available,
  };
  return {
    embeds: [
      {
        title: render(result.embed.title, values),
        description: render(result.embed.description, values),
        color: Number.parseInt(result.embed.color.slice(1), 16),
        footer: result.embed.footer ? { text: render(result.embed.footer, values) } : undefined,
      },
    ],
  };
}
