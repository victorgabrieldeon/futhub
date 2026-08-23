import type { LucroResponse } from '@futhub/api-client';
import type { InteractionReplyOptions } from 'discord.js';

function renderDescription(template: string, values: Readonly<Record<string, string>>): string {
  return Object.entries(values).reduce(
    (result, [token, value]) => result.replaceAll(`{${token}}`, value),
    template,
  );
}

export function formatCommandResult(
  result: LucroResponse,
  now: Date,
): string | InteractionReplyOptions {
  const availableAt = new Date(result.availableAt);
  if (!Number.isFinite(availableAt.getTime())) throw new Error('API returned an invalid date.');
  const available = `<t:${Math.floor(availableAt.getTime() / 1000)}:F>`;
  if (result.kind === 'cooldown') {
    const remaining = Math.max(0, Math.ceil((availableAt.getTime() - now.getTime()) / 1000));
    return `Aguarde ${remaining}s. Lucro disponível em ${available}.`;
  }
  const values = {
    message: result.reward.message,
    reward: String(result.reward.value),
    balance: String(result.balance),
    xp: String(result.progression.gainedXp),
    level: String(result.progression.level),
    availableAt: available,
  };
  return {
    embeds: [
      {
        color: Number.parseInt(result.embed.color.slice(1), 16),
        description: renderDescription(result.embed.description, values),
        footer: result.embed.footer ? { text: result.embed.footer } : undefined,
        title: result.embed.title,
      },
    ],
  };
}
