import { Fragment } from 'react';

function keyed(parts: readonly string[]) {
  const occurrences = new Map<string, number>();
  return parts.map((text) => {
    const occurrence = occurrences.get(text) ?? 0;
    occurrences.set(text, occurrence + 1);
    return { text, key: JSON.stringify([text, occurrence]) };
  });
}

function inline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\s)]+\))/g);
  return keyed(parts).map(({ text: part, key }) => {
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link)
      return (
        <a key={key} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function MarkdownMessage({ content }: Readonly<{ content: string }>) {
  const blocks = content.split(/\n{2,}/);
  return keyed(blocks).map(({ text: block, key }) => {
    const lines = block.split('\n');
    const list = lines.every((line) => /^[-*+]\s+/.test(line));
    if (list)
      return (
        <ul key={key}>
          {keyed(lines).map(({ text: line, key: lineKey }) => (
            <li key={lineKey}>{inline(line.replace(/^[-*+]\s+/, ''))}</li>
          ))}
        </ul>
      );
    const heading = block.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      if (heading[1].length === 1) return <h1 key={key}>{inline(heading[2])}</h1>;
      if (heading[1].length === 2) return <h2 key={key}>{inline(heading[2])}</h2>;
      return <h3 key={key}>{inline(heading[2])}</h3>;
    }
    return (
      <p key={key}>
        {keyed(lines).map(({ text: line, key: lineKey }, lineIndex) => (
          <Fragment key={lineKey}>
            {lineIndex > 0 && <br />}
            {inline(line)}
          </Fragment>
        ))}
      </p>
    );
  });
}
