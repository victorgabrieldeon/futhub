import { levelUpImage } from '../art/scenes.js';
import type { BotMessage } from './bot-response.js';
import { EMOJI } from './emojis.js';
import { h3 } from './format.js';
import { COLOR, illustrated, text } from './ui.js';

/** Quadro grande de subida de nível, compartilhado por lucro e packs; segura mais que os outros. */
export function levelUpFrame(
  progression: Readonly<{ level: number; rewards: readonly { type: string; quantity: number }[] }>,
): BotMessage {
  return illustrated(
    COLOR.gold,
    {
      name: `nivel-${progression.level}.png`,
      data: levelUpImage(progression),
      description: `Nível ${progression.level}`,
    },
    [text(h3(`${EMOJI.divisao} Subiu para o nível ${progression.level}!`))],
  ) as BotMessage;
}
