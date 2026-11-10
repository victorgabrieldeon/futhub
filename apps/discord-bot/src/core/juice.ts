import { type BotMessage, isComponentsV2 } from './bot-response.js';
import { COLOR, EPHEMERAL } from './ui.js';

/**
 * Game feel do bot. No Discord o "juice" vem de editar a mesma mensagem em quadros: antecipação,
 * impacto (um quadro que segura mais tempo, como um hit-stop) e o resultado. A intensidade segue a
 * importância do evento: ações rotineiras não animam; lucro, packs, gols e subir de nível sim.
 *
 * `BOT_ANIMATIONS=off` desliga os quadros (acessibilidade ou canais lentos); só o resultado é enviado.
 */
export const juice = {
  frameDelayMs: Number(process.env.BOT_FRAME_DELAY_MS ?? 1_500),
  enabled: process.env.BOT_ANIMATIONS !== 'off',
};

/** Como uma cena conversa com o Discord; comandos e componentes têm contextos diferentes. */
export type Stage = Readonly<{
  reply: (message: BotMessage) => Promise<unknown>;
  edit: (message: BotMessage) => Promise<unknown>;
  remove: () => Promise<unknown>;
  followup: (message: BotMessage) => Promise<unknown>;
}>;

type Replier = Readonly<{
  write: (message: BotMessage) => Promise<unknown>;
  editOrReply: (message: BotMessage) => Promise<unknown>;
  deleteResponse: () => Promise<unknown>;
  followup: (message: BotMessage) => Promise<unknown>;
}>;

/** Palco de um comando ou componente; depois de `deferReply` a primeira resposta é uma edição. */
export function stageOf(context: Replier, deferred = false): Stage {
  return {
    reply: (message) => (deferred ? context.editOrReply(message) : context.write(message)),
    edit: (message) => context.editOrReply(message),
    remove: () => context.deleteResponse(),
    followup: (message) => context.followup(message),
  };
}

export const sleep = (ms: number) =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

const withoutEphemeral = (message: BotMessage): BotMessage => ({
  ...message,
  flags: (message.flags ?? 0) & ~EPHEMERAL,
});

export type Scene = Readonly<{
  /** Mostra um quadro e segura por `hold` × o ritmo base. Sem animações, não faz nada. */
  frame: (message: BotMessage, hold?: number) => Promise<void>;
  /** Fecha a cena com o resultado; troca a mensagem se ele não puder substituir os quadros. */
  finish: (message: BotMessage) => Promise<void>;
}>;

export function scene(stage: Stage, options: Readonly<{ ephemeral?: boolean }> = {}): Scene {
  let started = false;
  const visibility = (message: BotMessage): BotMessage =>
    options.ephemeral ? { ...message, flags: (message.flags ?? 0) | EPHEMERAL } : message;
  return {
    async frame(message, hold = 1) {
      if (!juice.enabled) return;
      if (started) await stage.edit(withoutEphemeral(message));
      else await stage.reply(visibility(message));
      started = true;
      await sleep(juice.frameDelayMs * hold);
    },
    async finish(message) {
      if (!started) {
        await stage.reply(visibility(message));
        return;
      }
      // Uma mensagem Components V2 não volta a ser texto/embed: troca por uma nova.
      if (isComponentsV2(message)) await stage.edit(withoutEphemeral(message));
      else {
        await stage.remove();
        await stage.followup(visibility(message));
      }
    },
  };
}

export type Rarity = Readonly<{ rank: number; label: string; emoji: string; color: string }>;

const RARITIES: readonly (Rarity & { min: number })[] = [
  { min: 95, rank: 5, label: 'Ícone', emoji: '💎', color: '#ff5ea8' },
  { min: 90, rank: 4, label: 'Lendária', emoji: '🟡', color: COLOR.gold },
  { min: 85, rank: 3, label: 'Épica', emoji: '🟣', color: '#8b5cf6' },
  { min: 80, rank: 2, label: 'Rara', emoji: '🔵', color: COLOR.info },
  { min: 75, rank: 1, label: 'Incomum', emoji: '🟢', color: COLOR.brand },
  { min: 0, rank: 0, label: 'Comum', emoji: '⚪', color: '#9aa0a6' },
];

export function rarity(overall: number): Rarity {
  const tier = RARITIES.find((candidate) => overall >= candidate.min);
  return {
    rank: tier?.rank ?? 0,
    label: tier?.label ?? 'Comum',
    emoji: tier?.emoji ?? '⚪',
    color: tier?.color ?? '#9aa0a6',
  };
}

/** Valores intermediários com ease-out: sobe rápido e assenta no alvo, como um contador. */
export function countUp(target: number, steps: number): number[] {
  return Array.from({ length: steps }, (_, index) => {
    const t = (index + 1) / steps;
    return Math.round(target * (1 - (1 - t) ** 3));
  });
}

type Progression = Readonly<{
  gainedXp: number;
  xp: number;
  level: number;
  nextLevelXp: number;
  rewards: readonly { type: string; quantity: number }[];
}>;

/** XP dentro do nível menor que o ganho significa que a barra virou. */
export function leveledUp(progression: Progression): boolean {
  return progression.gainedXp > progression.xp;
}
