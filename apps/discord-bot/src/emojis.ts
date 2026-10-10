/**
 * Emojis da aplicação no Discord. Cada nome tem um SVG em `assets/emojis/<nome>.svg`;
 * o bot sobe os que faltarem ao iniciar (ver `emoji-sync.ts`). IDs mudam de uma aplicação
 * para outra, então só os nomes são fixos: até a sincronização, cada emoji usa o unicode.
 */
export const EMOJI_FALLBACK = {
  alerta: '⚠️',
  ao_vivo: '🔴',
  apito: '📣',
  buscar: '🔎',
  capitao: '©️',
  carta: '🃏',
  cartao_amarelo: '🟨',
  cartao_vermelho: '🟥',
  clube: '🛡️',
  cpu: '🤖',
  divisao: '🎖️',
  erro: '❌',
  escalacao: '📋',
  estadio: '🏟️',
  favorito: '⭐',
  fim_de_jogo: '🏁',
  gol: '⚽',
  loja: '🛍️',
  lucro: '💰',
  mercado: '🔁',
  missao: '🎯',
  moeda: '🪙',
  pack: '📦',
  resgatar: '🎁',
  sucesso: '✅',
  tatica: '♟️',
  time: '👕',
  trofeu: '🏆',
} as const;

export type EmojiName = keyof typeof EMOJI_FALLBACK;
export type ApplicationEmoji = { id: string; name: string; animated?: boolean };

export const EMOJI_NAMES = Object.keys(EMOJI_FALLBACK) as EmojiName[];

const mentions = new Map<EmojiName, string>();

/** Menção `<:nome:id>` de cada emoji, pronta para mensagens, embeds e botões. */
export const EMOJI: Readonly<Record<EmojiName, string>> = Object.defineProperties(
  {} as Record<EmojiName, string>,
  Object.fromEntries(
    EMOJI_NAMES.map((name) => [
      name,
      { enumerable: true, get: () => mentions.get(name) ?? EMOJI_FALLBACK[name] },
    ]),
  ),
);

export function isEmojiName(name: string): name is EmojiName {
  return Object.hasOwn(EMOJI_FALLBACK, name);
}

export function registerEmojis(emojis: readonly ApplicationEmoji[]): void {
  for (const emoji of emojis)
    if (isEmojiName(emoji.name))
      mentions.set(emoji.name, `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`);
}
