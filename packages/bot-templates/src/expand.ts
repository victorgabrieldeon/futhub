import type { ListFormat, ListItem, TemplateData } from './types.js';

export const pipes = {
  upper: 'MAIÚSCULAS',
  lower: 'minúsculas',
  number: 'Número com separador de milhar (4.250)',
  signed: 'Número com sinal (+500 / -20)',
  count: 'Quantidade de itens de uma lista',
} as const;
export type Pipe = keyof typeof pipes;

/** `name` is a variable, or the emoji name when `emoji` is set (`{emoji:moeda}`). */
export type Token = { raw: string; name: string; pipes: string[]; emoji?: true };

export const EMOJI_NAME = /^[A-Za-z0-9_]{2,32}$/;

const TOKEN = /\{([^{}]*)\}/g;

export function parseToken(raw: string): Token | null {
  const [name = '', ...rest] = raw
    .slice(1, -1)
    .split('|')
    .map((part) => part.trim());
  const emoji = /^emoji:(.*)$/.exec(name);
  if (emoji)
    return EMOJI_NAME.test(emoji[1] ?? '')
      ? { raw, name: emoji[1] ?? '', pipes: rest, emoji: true }
      : null;
  if (!/^[A-Za-z][\w]{0,39}$/.test(name)) return null;
  return { raw, name, pipes: rest };
}

/** Every `{...}` in the text, including malformed ones (as null). */
export function tokens(text: string): (Token | null)[] {
  return [...text.matchAll(TOKEN)].map((match) => parseToken(match[0]));
}

/** Text with every brace token removed; leftover braces mean a malformed token. */
export function literal(text: string): string {
  return text.replace(TOKEN, '');
}

function number(value: string): string {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed.toLocaleString('pt-BR') : value;
}

function applyPipes(value: string, names: string[]): string {
  return names.reduce((current, pipe) => {
    switch (pipe) {
      case 'upper':
        return current.toLocaleUpperCase('pt-BR');
      case 'lower':
        return current.toLocaleLowerCase('pt-BR');
      case 'number':
        return number(current);
      case 'signed': {
        const parsed = Number(current);
        if (!current.trim() || !Number.isFinite(parsed)) return current;
        return `${parsed > 0 ? '+' : ''}${parsed.toLocaleString('pt-BR')}`;
      }
      default:
        return current;
    }
  }, value);
}

export type Scope = {
  data: TemplateData;
  /** Formats for list tokens; lists without one use `fallback`. */
  formats: readonly ListFormat[];
  fallback: (source: string) => Omit<ListFormat, 'source'> | undefined;
  /** Renders `{emoji:name}`; unknown emojis use `emojiFallback`, then `:name:`. */
  emojis?: ReadonlyMap<string, BotEmoji>;
  /** Unicode stand-in for emojis the application does not have yet. */
  emojiFallback?: (name: string) => string | undefined;
  /** Images cannot draw Discord emojis, so canvas text drops them. */
  stripEmojis?: boolean;
};

export type BotEmoji = { id: string; name: string; animated: boolean };

export function emojiMention(emoji: BotEmoji): string {
  return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
}

export function findEmoji(scope: Scope, name: string): BotEmoji | undefined {
  return scope.emojis?.get(name) ?? scope.emojis?.get(name.toLowerCase());
}

export function listFormat(scope: Scope, source: string): Omit<ListFormat, 'source'> {
  return (
    scope.formats.find((format) => format.source === source) ??
    scope.fallback(source) ?? { item: '{index}', separator: '\n', empty: '', limit: 10, more: '' }
  );
}

// Lists are dropped so item and overflow text can never recurse into a list.
function scalars(scope: Scope, extra: Record<string, string>): Scope {
  const data = Object.fromEntries(
    Object.entries(scope.data).filter((entry) => !Array.isArray(entry[1])),
  );
  return { ...scope, data: { ...data, ...extra } };
}

export function itemScope(scope: Scope, item: ListItem, index: number): Scope {
  return scalars(scope, { ...item, index: String(index + 1) });
}

export function formatList(scope: Scope, source: string, items: readonly ListItem[]): string {
  const format = listFormat(scope, source);
  if (!items.length) return expand(format.empty, scalars(scope, {}));
  const limit = Math.max(1, Math.min(format.limit, 50));
  const shown = items
    .slice(0, limit)
    // Trailing spaces left by empty optional fields are dropped, as hand-written text would.
    .map((item, index) => expand(format.item, itemScope(scope, item, index)).trimEnd());
  const rest = items.length - shown.length;
  const more =
    rest > 0 && format.more
      ? expand(format.more, scalars(scope, { rest: String(rest), total: String(items.length) }))
      : '';
  const local = scalars(scope, {});
  return `${expand(format.prefix ?? '', local)}${[shown.join(format.separator), more]
    .filter(Boolean)
    .join(format.separator)}${expand(format.suffix ?? '', local)}`;
}

/** Single-pass expansion: inserted values are never expanded again. */
export function expand(text: string, scope: Scope): string {
  return text.replace(TOKEN, (raw) => {
    const token = parseToken(raw);
    if (token?.emoji) {
      if (scope.stripEmojis) return '';
      const emoji = findEmoji(scope, token.name);
      return emoji ? emojiMention(emoji) : (scope.emojiFallback?.(token.name) ?? `:${token.name}:`);
    }
    if (!token || !Object.hasOwn(scope.data, token.name)) return raw;
    const value = scope.data[token.name];
    if (Array.isArray(value)) {
      if (token.pipes.includes('count')) return applyPipes(String(value.length), token.pipes);
      return applyPipes(formatList(scope, token.name, value), token.pipes);
    }
    return applyPipes(value ?? '', token.pipes);
  });
}
