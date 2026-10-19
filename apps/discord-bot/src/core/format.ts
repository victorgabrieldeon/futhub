/**
 * Texto do bot: números em pt-BR e o markdown do Discord. Funções puras, sem Seyfert, para
 * servirem tanto às mensagens quanto às imagens geradas.
 */

/** Número no formato brasileiro: `1.500`. */
export function fmt(value: number): string {
  return value.toLocaleString('pt-BR');
}

/** Quantidade com a palavra certa: `1 carta`, `3 cartas`. */
export function plural(count: number, one: string, many: string): string {
  return `${fmt(count)} ${count === 1 ? one : many}`;
}

/** Sinal sempre à mostra, com o menos tipográfico: `+1.500`, `−300`. */
export function signed(value: number): string {
  return `${value >= 0 ? '+' : '−'}${fmt(Math.abs(value))}`;
}

/** Dois dígitos: `07`. */
export function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function bold(value: string | number): string {
  return `**${value}**`;
}

/** Código em linha: `` `/time` ``. */
export function code(value: string | number): string {
  return `\`${value}\``;
}

export function h1(value: string): string {
  return `# ${value}`;
}

export function h2(value: string): string {
  return `## ${value}`;
}

export function h3(value: string): string {
  return `### ${value}`;
}

/** Linha pequena e apagada, para dicas e detalhes. */
export function subtext(value: string): string {
  return `-# ${value}`;
}

/** Data no fuso de quem lê: `f` data e hora, `F` com o dia da semana, `R` relativa. */
export function timestamp(date: Date, style: 'f' | 'F' | 'R'): string {
  return `<t:${Math.floor(date.getTime() / 1_000)}:${style}>`;
}
