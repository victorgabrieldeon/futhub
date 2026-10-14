import type { ReactNode } from 'react';

// Approximates Discord markdown for the preview; output is React nodes only (no HTML injection).

const INLINE =
  /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|~~(.+?)~~|\|\|(.+?)\|\||`([^`]+)`|<t:(-?\d+)(?::([tTdDfFR]))?>|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|<(a?):(\w{2,32}):(\d{17,20})>)/;

function timestamp(seconds: number, style = 'f'): string {
  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) return String(seconds);
  if (style === 'R') {
    const diff = Math.round((date.getTime() - Date.now()) / 1000);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31_536_000],
      ['month', 2_592_000],
      ['day', 86_400],
      ['hour', 3_600],
      ['minute', 60],
      ['second', 1],
    ];
    const [unit, size] = units.find(([, size]) => Math.abs(diff) >= size) ?? ['second', 1];
    return new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(
      Math.round(diff / size),
      unit,
    );
  }
  const options: Record<string, Intl.DateTimeFormatOptions> = {
    t: { timeStyle: 'short' },
    T: { timeStyle: 'medium' },
    d: { dateStyle: 'short' },
    D: { dateStyle: 'long' },
    f: { dateStyle: 'long', timeStyle: 'short' },
    F: { dateStyle: 'full', timeStyle: 'short' },
  };
  return new Intl.DateTimeFormat('pt-BR', options[style] ?? options.f).format(date);
}

export function inline(text: string, key = 'i'): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let index = 0;
  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      nodes.push(rest);
      break;
    }
    if (match.index) nodes.push(rest.slice(0, match.index));
    const k = `${key}-${index++}`;
    const [
      ,
      ,
      boldItalic,
      bold,
      underline,
      italic,
      italic2,
      strike,
      spoiler,
      code,
      time,
      style,
      label,
      href,
      animated,
      emojiName,
      emojiId,
    ] = match;
    if (boldItalic !== undefined)
      nodes.push(
        <strong key={k}>
          <em>{inline(boldItalic, k)}</em>
        </strong>,
      );
    else if (bold !== undefined) nodes.push(<strong key={k}>{inline(bold, k)}</strong>);
    else if (underline !== undefined) nodes.push(<u key={k}>{inline(underline, k)}</u>);
    else if ((italic ?? italic2) !== undefined)
      nodes.push(<em key={k}>{inline(italic ?? italic2 ?? '', k)}</em>);
    else if (strike !== undefined) nodes.push(<s key={k}>{inline(strike, k)}</s>);
    else if (spoiler !== undefined)
      nodes.push(
        <span key={k} className="discord-spoiler">
          {inline(spoiler, k)}
        </span>,
      );
    else if (code !== undefined) nodes.push(<code key={k}>{code}</code>);
    else if (time !== undefined)
      nodes.push(
        <span key={k} className="discord-timestamp">
          {timestamp(Number(time), style)}
        </span>,
      );
    else if (emojiId)
      nodes.push(
        <img
          key={k}
          className="discord-emoji"
          alt={`:${emojiName}:`}
          title={`:${emojiName}:`}
          src={`https://cdn.discordapp.com/emojis/${emojiId}.${animated ? 'gif' : 'png'}`}
        />,
      );
    else if (label !== undefined && href)
      nodes.push(
        <a key={k} href={href} target="_blank" rel="noreferrer">
          {inline(label, k)}
        </a>,
      );
    rest = rest.slice(match.index + match[0].length);
  }
  return nodes;
}

export function DiscordMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    const key = `l${index}`;
    if (line.startsWith('```')) {
      const body: string[] = [];
      while (++index < lines.length && !(lines[index] ?? '').startsWith('```'))
        body.push(lines[index] ?? '');
      blocks.push(
        <pre key={key} className="discord-codeblock">
          {body.join('\n')}
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,3}) (.*)$/.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      blocks.push(
        <p key={key} className={`discord-h${level}`}>
          {inline(heading[2] ?? '', key)}
        </p>,
      );
    } else if (line.startsWith('-# '))
      blocks.push(
        <p key={key} className="discord-subtext">
          {inline(line.slice(3), key)}
        </p>,
      );
    else if (line.startsWith('> '))
      blocks.push(
        <blockquote key={key} className="discord-quote">
          {inline(line.slice(2), key)}
        </blockquote>,
      );
    else if (/^[-*] /.test(line))
      blocks.push(
        <p key={key} className="discord-bullet">
          <span aria-hidden="true">•</span> {inline(line.slice(2), key)}
        </p>,
      );
    else blocks.push(<p key={key}>{line ? inline(line, key) : ' '}</p>);
  }
  return <div className="discord-markdown">{blocks}</div>;
}
