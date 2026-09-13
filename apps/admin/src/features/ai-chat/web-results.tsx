import { record } from './api';

type Source = Readonly<{ title: string; url: string; description: string }>;
function source(value: unknown): value is Source {
  return (
    record(value) &&
    typeof value.title === 'string' &&
    typeof value.url === 'string' &&
    typeof value.description === 'string'
  );
}
function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function WebResults({ content }: Readonly<{ content: string }>) {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return <p>{content}</p>;
  }
  if (
    !record(value) ||
    typeof value.query !== 'string' ||
    !Array.isArray(value.sources) ||
    !value.sources.every(source)
  )
    return <p>{content}</p>;
  return (
    <section className="ai-web-results" aria-label="Fontes da consulta web">
      <p>Consulta: {value.query}</p>
      {!value.sources.length && <p>Nenhuma fonte encontrada para esta consulta.</p>}
      <ul>
        {value.sources.map((entry, index) => {
          const href = safeUrl(entry.url);
          return (
            <li key={`${index}-${entry.url}`}>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  {entry.title || 'Abrir fonte'} <span>(abre em nova aba)</span>
                </a>
              ) : (
                <strong>{entry.title || 'Fonte sem link seguro'}</strong>
              )}
              <p>{entry.description}</p>
              <p>{entry.url}</p>
              {!href && <p>Link indisponível: endereço não permitido.</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
