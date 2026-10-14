import { ApiClientError } from '@futhub/api-client';
import {
  ActionRow,
  Button,
  ButtonStyle,
  Container,
  type ContainerBuilderComponents,
  MediaGallery,
  MediaGalleryItem,
  Separator,
  TextDisplay,
  type TopLevelBuilders,
} from 'seyfert';

import { EMOJI, type EmojiMention, type EmojiName, isEmojiName } from './emojis.js';
import { noMentions } from './responses.js';

/**
 * Kit visual do bot: uma paleta, um jeito de formatar números e tempo e um jeito de montar
 * painéis Components V2. Toda resposta nova deve sair daqui para o bot falar uma língua só.
 */
export const COLOR = {
  brand: '#1f9d55',
  gold: '#e3a72f',
  store: '#8b1d3d',
  market: '#176b5b',
  info: '#3b82f6',
  danger: '#e5484d',
  warning: '#f59e0b',
  neutral: '#2b2d31',
} as const;

export const COMPONENTS_V2 = 32768;
export const EPHEMERAL = 64;

export function fmt(value: number): string {
  return value.toLocaleString('pt-BR');
}

export function plural(count: number, one: string, many: string): string {
  return `${fmt(count)} ${count === 1 ? one : many}`;
}

export function coins(value: number): string {
  return `${EMOJI.moeda} **${fmt(value)}**`;
}

/** Barra de progresso em texto; `ratio` é limitado a 0–1. */
export function bar(ratio: number, size = 10): string {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * size);
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

export function discordTime(value: string | Date, style: 'R' | 'F' | 'f' | 't' = 'R'): string {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? `<t:${Math.floor(time / 1_000)}:${style}>` : String(value);
}

/** Linhas de texto sem os itens vazios, para montar blocos condicionais sem `filter` solto. */
export function lines(...items: readonly (string | false | null | undefined)[]): string {
  return items.filter((item) => typeof item === 'string').join('\n');
}

export function text(...items: readonly (string | false | null | undefined)[]): TextDisplay {
  return new TextDisplay().setContent(lines(...items));
}

export function divider(large = false): Separator {
  return new Separator().setDivider(true).setSpacing(large ? 2 : 1);
}

export function panel(
  color: string | number,
  ...children: readonly (ContainerBuilderComponents | undefined | false)[]
): Container {
  return new Container()
    .setColor(color as `#${string}`)
    .setComponents(
      ...children.filter((child): child is ContainerBuilderComponents => Boolean(child)),
    );
}

export function button(
  customId: string,
  label: string,
  emoji: EmojiName | EmojiMention | undefined,
  style: ButtonStyle = ButtonStyle.Secondary,
  disabled = false,
): Button {
  const built = new Button()
    .setCustomId(customId)
    .setLabel(label.slice(0, 80))
    .setStyle(style)
    .setDisabled(disabled);
  if (!emoji) return built;
  return built.setEmoji(isEmojiName(emoji) ? EMOJI[emoji] : emoji);
}

export function row(...buttons: readonly (Button | undefined | false)[]): ActionRow<Button> {
  return new ActionRow<Button>().setComponents(
    ...buttons.filter((item): item is Button => item instanceof Button).slice(0, 5),
  );
}

/** Imagem gerada pelo bot, anexada como `attachment://<name>`. */
export type Picture = Readonly<{ name: string; data: Buffer; description?: string }>;

export type V2Message = {
  flags: number;
  components: TopLevelBuilders[];
  allowedMentions: typeof noMentions;
  files?: { filename: string; data: Buffer }[];
};

export function gallery(picture: Picture): MediaGallery {
  const item = new MediaGalleryItem().setMedia(`attachment://${picture.name}`);
  return new MediaGallery().addItems(
    picture.description ? item.setDescription(picture.description) : item,
  );
}

/** Painel com a imagem gerada como peça principal, no topo, e o resto embaixo. */
export function illustrated(
  color: string | number,
  picture: Picture,
  children: readonly (ContainerBuilderComponents | undefined | false)[] = [],
  ephemeral = false,
): V2Message {
  return {
    ...v2([panel(color, gallery(picture), ...children)], ephemeral),
    files: [{ filename: picture.name, data: picture.data }],
  };
}

export function v2(components: TopLevelBuilders[], ephemeral = false): V2Message {
  return {
    flags: COMPONENTS_V2 | (ephemeral ? EPHEMERAL : 0),
    components,
    allowedMentions: noMentions,
  };
}

type Tone = 'error' | 'warning' | 'success' | 'info';
const toneStyle: Record<Tone, [EmojiName, string]> = {
  error: ['erro', COLOR.danger],
  warning: ['alerta', COLOR.warning],
  success: ['sucesso', COLOR.brand],
  info: ['relogio', COLOR.info],
};

/** Aviso curto e privado: título, explicação e, quando houver, o próximo passo. */
export function notice(tone: Tone, title: string, detail?: string, hint?: string): V2Message {
  const [emoji, color] = toneStyle[tone];
  return v2(
    [panel(color, text(`### ${EMOJI[emoji]} ${title}`, detail, hint && `-# ${hint}`))],
    true,
  );
}

/** Painel expirado ou de outro jogador; os dois casos aparecem em todos os componentes. */
export function sessionNotice(kind: 'foreign' | 'expired', command: string): V2Message {
  return kind === 'foreign'
    ? notice(
        'warning',
        'Este painel não é seu',
        'Cada jogador navega no próprio painel.',
        `Use /${command} para abrir o seu.`,
      )
    : notice(
        'info',
        'Painel expirado',
        'Painéis ficam ativos por 15 minutos.',
        `Use /${command} para abrir de novo.`,
      );
}

const API_MESSAGES: readonly [RegExp, string][] = [
  [/insufficient balance/i, 'Saldo insuficiente.'],
  [/pack limit reached/i, 'Você atingiu o limite deste pack por jogador.'],
  [/does not own this pack/i, 'Você não tem este pack no inventário.'],
  [/inventory capacity exceeded/i, 'Seu elenco está cheio. Venda jogadores para liberar espaço.'],
  [/balance limit exceeded/i, 'Seu saldo atingiu o limite máximo.'],
  [/card is not available for purchase/i, 'Esta carta não está mais à venda.'],
  [/pack is not available for purchase/i, 'Este pack não está mais à venda.'],
  [/cannot be sold/i, 'Titulares, favoritos e o capitão não podem ser vendidos.'],
  [/maximum level/i, 'O estádio já está no nível máximo.'],
  [/11 holders|lineup must contain/i, 'Escale 11 titulares antes de jogar.'],
];

/** Traduz falhas da API para algo que o jogador consiga resolver. */
export function friendlyError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiClientError)) return fallback;
  const known = API_MESSAGES.find(([pattern]) => pattern.test(error.message));
  if (known) return known[1];
  if (error.status === 404) return 'Não encontrado. Pode ter sido removido ou estar indisponível.';
  if (error.status >= 500) return `${fallback} O servidor do jogo não respondeu.`;
  return fallback;
}
