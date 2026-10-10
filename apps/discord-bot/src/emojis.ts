/**
 * Emojis da aplicação no Discord. Cada nome tem um SVG em `assets/emojis/<nome>.svg`;
 * o bot sobe os que faltarem ao iniciar (ver `emoji-sync.ts`). IDs mudam de uma aplicação
 * para outra, então só os nomes são fixos: até a sincronização, cada emoji usa o unicode.
 */
export const EMOJI_FALLBACK = {
  alerta: '⚠️',
  anterior: '◀️',
  ao_vivo: '🔴',
  apito: '📣',
  ataque: '⏩',
  atualizar: '🔄',
  automatico: '✨',
  buscar: '🔎',
  capitao: '©️',
  carta: '🃏',
  cartao_amarelo: '🟨',
  cartao_vermelho: '🟥',
  clube: '🛡️',
  config: '⚙️',
  contratar: '🤝',
  cpu: '🤖',
  defesa: '🛡️',
  divisao: '🎖️',
  elenco: '👥',
  erro: '❌',
  escalacao: '📋',
  estadio: '🏟️',
  favorito: '⭐',
  filtro: '🔽',
  fim_de_jogo: '🏁',
  forca: '⚡',
  gol: '⚽',
  goleiro: '🧤',
  loja: '🛍️',
  lucro: '💰',
  meio: '⚖️',
  mercado: '🔁',
  missao: '🎯',
  moeda: '🪙',
  ordenar: '↕️',
  pack: '📦',
  proxima: '▶️',
  relogio: '⏳',
  resgatar: '🎁',
  sucesso: '✅',
  tatica: '♟️',
  time: '👕',
  trofeu: '🏆',
  venda: '🏷️',
  visao_geral: '📊',
} as const;

export type EmojiName = keyof typeof EMOJI_FALLBACK;
export type ApplicationEmoji = { id: string; name: string; animated?: boolean };

export const EMOJI_NAMES = Object.keys(EMOJI_FALLBACK) as EmojiName[];

const registered = new Map<EmojiName, ApplicationEmoji>();

function mention(emoji: ApplicationEmoji): string {
  return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
}

/** Menção `<:nome:id>` de cada emoji, pronta para mensagens, embeds e botões. */
export const EMOJI: Readonly<Record<EmojiName, string>> = Object.defineProperties(
  {} as Record<EmojiName, string>,
  Object.fromEntries(
    EMOJI_NAMES.map((name) => [
      name,
      {
        enumerable: true,
        get: () => {
          const emoji = registered.get(name);
          return emoji ? mention(emoji) : EMOJI_FALLBACK[name];
        },
      },
    ]),
  ),
);

export function isEmojiName(name: string): name is EmojiName {
  return Object.hasOwn(EMOJI_FALLBACK, name);
}

export function registerEmojis(emojis: readonly ApplicationEmoji[]): void {
  for (const emoji of emojis) if (isEmojiName(emoji.name)) registered.set(emoji.name, emoji);
}

export function registeredEmojis(): ApplicationEmoji[] {
  return [...registered.values()];
}

/** Emoji no formato de opções de select, que não aceitam a menção em texto. */
export function selectEmoji(name: EmojiName): { id?: string; name: string; animated?: boolean } {
  const emoji = registered.get(name);
  return emoji
    ? { id: emoji.id, name: emoji.name, animated: emoji.animated === true }
    : { name: EMOJI_FALLBACK[name] };
}

const positionEmojis: Readonly<Record<string, EmojiName>> = {
  GOL: 'goleiro',
  LD: 'defesa',
  LE: 'defesa',
  ZAG: 'defesa',
  VOL: 'meio',
  MC: 'meio',
  MA: 'meio',
  PD: 'ataque',
  PE: 'ataque',
  CA: 'ataque',
};

/** Setor do campo de cada posição: goleiro, defesa, meio ou ataque. */
export function positionEmoji(position: string): EmojiName {
  return positionEmojis[position] ?? 'escalacao';
}

/** Ícone de cada tipo de lance das partidas (liga e partida de teste). */
export const MATCH_EVENT_EMOJI = {
  kickoff: 'apito',
  goal: 'gol',
  yellow_card: 'cartao_amarelo',
  red_card: 'cartao_vermelho',
  fulltime: 'fim_de_jogo',
} as const satisfies Record<string, EmojiName>;
