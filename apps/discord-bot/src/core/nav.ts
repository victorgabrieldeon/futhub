import { ButtonStyle } from 'seyfert';

import type { EmojiMention, EmojiName } from './emojis.js';
import { button } from './ui.js';

/**
 * Atalhos entre telas. Não carregam estado: cada clique abre a tela de quem clicou, então
 * qualquer jogador pode usar os botões de uma mensagem pública. O dono da mensagem tem as
 * telas atualizadas no lugar; os demais recebem uma resposta privada.
 */
export const NAV_TARGETS = [
  'hub',
  'lucro',
  'missoes',
  'packs',
  'open',
  'loja',
  'time',
  'liga',
  'ajuda',
] as const;
export type NavTarget = (typeof NAV_TARGETS)[number];

const PREFIX = 'nv1';

export function navId(target: NavTarget, ownerId: string, arg = '_'): string {
  return `${PREFIX}:${target}:${ownerId}:${arg}`;
}

export function isNavId(customId: string): boolean {
  return customId.startsWith(`${PREFIX}:`);
}

export function parseNavId(
  customId: string,
): { target: NavTarget; ownerId: string; arg: string } | null {
  const [prefix, target, ownerId, arg, extra] = customId.split(':');
  if (prefix !== PREFIX || extra !== undefined || !ownerId || !arg) return null;
  if (!(NAV_TARGETS as readonly string[]).includes(target ?? '')) return null;
  if (!/^\d{1,20}$/.test(ownerId) || !/^[A-Za-z0-9_-]{1,64}$/.test(arg)) return null;
  return { target: target as NavTarget, ownerId, arg };
}

const DEFAULTS: Record<NavTarget, [string, EmojiName]> = {
  hub: ['Início', 'visao_geral'],
  lucro: ['Resgatar lucro', 'lucro'],
  missoes: ['Missões', 'missao'],
  packs: ['Meus packs', 'pack'],
  open: ['Abrir', 'pack'],
  loja: ['Loja', 'loja'],
  time: ['Meu time', 'time'],
  liga: ['Liga', 'trofeu'],
  ajuda: ['Ajuda', 'buscar'],
};

export function navButton(
  target: NavTarget,
  ownerId: string,
  options: Readonly<{
    arg?: string;
    label?: string;
    emoji?: EmojiName | EmojiMention;
    style?: ButtonStyle;
    disabled?: boolean;
  }> = {},
) {
  const [label, emoji] = DEFAULTS[target];
  return button(
    navId(target, ownerId, options.arg),
    options.label ?? label,
    options.emoji ?? emoji,
    options.style ?? ButtonStyle.Secondary,
    options.disabled ?? false,
  );
}
