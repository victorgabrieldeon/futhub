import { Fragment } from 'react';

function inline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\s)]+\))/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link)
      return (
        <a key={index} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function MarkdownMessage({ content }: Readonly<{ content: string }>) {
  const blocks = content.split(/\n{2,}/);
  return blocks.map((block, index) => {
    const lines = block.split('\n');
    const list = lines.every((line) => /^[-*+]\s+/.test(line));
    if (list)
      return (
        <ul key={index}>
          {lines.map((line, item) => (
            <li key={item}>{inline(line.replace(/^[-*+]\s+/, ''))}</li>
          ))}
        </ul>
      );
    const heading = block.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      if (heading[1].length === 1) return <h1 key={index}>{inline(heading[2])}</h1>;
      if (heading[1].length === 2) return <h2 key={index}>{inline(heading[2])}</h2>;
      return <h3 key={index}>{inline(heading[2])}</h3>;
    }
    return <p key={index}>{lines.map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 && <br />}{inline(line)}</Fragment>)}</p>;
  });
}
