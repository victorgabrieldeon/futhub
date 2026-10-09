import {
  type Definition,
  type ListDefinition,
  type ListFormat,
  type Scope,
  expand,
} from '@futhub/bot-templates';
import { DiscordMarkdown } from './discord-markdown';
import { TextField, type TextFocus } from './editor';

const separators = [
  ['\n', 'Uma por linha'],
  ['\n\n', 'Linha em branco entre itens'],
  [' · ', 'Na mesma linha ( · )'],
  [', ', 'Separados por vírgula'],
  [' | ', 'Separados por barra ( | )'],
] as const;

function formatPresets(list: ListDefinition): { label: string; item: string }[] {
  const [first, second, third] = list.fields.map((field) => `{${field.name}}`);
  const a = first ?? '{index}';
  const b = second ?? '';
  return [
    { label: 'Padrão do catálogo', item: list.defaultFormat.item },
    { label: 'Marcadores', item: `• **${a}**${b ? ` — ${b}` : ''}` },
    { label: 'Numerada', item: `\`{index}.\` **${a}**${b ? ` · ${b}` : ''}` },
    { label: 'Cartão', item: `### ${a}\n${[b, third].filter(Boolean).join(' · ')}` },
    { label: 'Citação', item: `> **${a}**${b ? `\n> ${b}` : ''}` },
    { label: 'Subtexto', item: `**${a}**${b ? `\n-# ${b}` : ''}` },
  ];
}

function ListCard({
  list,
  format,
  onChange,
  scope,
  focus,
  insert,
}: {
  list: ListDefinition;
  format: ListFormat | undefined;
  onChange: (format: ListFormat | undefined) => void;
  scope: Scope;
  focus: TextFocus;
  insert: (token: string) => void;
}) {
  const current = format ?? { source: list.name, ...list.defaultFormat };
  const edit = (patch: Partial<ListFormat>) => onChange({ ...current, ...patch });
  const custom = !separators.some(([value]) => value === current.separator);
  const chips = [
    { token: '{index}', description: 'Posição do item (1, 2, 3…)' },
    ...list.fields.map((field) => ({ token: `{${field.name}}`, description: field.description })),
  ];
  const preview = expand(`{${list.name}}`, {
    ...scope,
    formats: [current, ...scope.formats.filter((entry) => entry.source !== list.name)],
  });
  return (
    <fieldset className="response-block list-card">
      <legend>
        <code>{`{${list.name}}`}</code> {list.description}
      </legend>
      <div className="response-order">
        {format ? (
          <button type="button" onClick={() => onChange(undefined)}>
            Voltar ao padrão
          </button>
        ) : (
          <button type="button" className="ops-button accent" onClick={() => onChange(current)}>
            Personalizar formato
          </button>
        )}
        <small>
          Use <code>{`{${list.name}}`}</code> em qualquer texto e{' '}
          <code>{`{${list.name}|count}`}</code> para a quantidade.
        </small>
      </div>
      {format && (
        <>
          <div className="list-presets" aria-label="Modelos de item">
            {formatPresets(list).map((preset) => (
              <button
                type="button"
                key={preset.label}
                data-active={preset.item === current.item}
                onClick={() => edit({ item: preset.item })}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <TextField
            label="Modelo de cada item"
            multiline
            maxLength={1000}
            value={current.item}
            focus={focus}
            onChange={(item) => edit({ item })}
          />
          <div className="token-chips">
            {chips.map((chip) => (
              <button
                type="button"
                key={chip.token}
                title={chip.description}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insert(chip.token)}
              >
                {chip.token}
              </button>
            ))}
          </div>
          <div className="designer-grid">
            <label className="response-field">
              Separador
              <select
                value={custom ? 'custom' : current.separator}
                onChange={(event) =>
                  edit({ separator: event.target.value === 'custom' ? ' ' : event.target.value })
                }
              >
                {separators.map(([value, text]) => (
                  <option key={text} value={value}>
                    {text}
                  </option>
                ))}
                <option value="custom">Personalizado…</option>
              </select>
            </label>
            {custom && (
              <TextField
                label="Separador personalizado"
                value={current.separator}
                maxLength={20}
                focus={focus}
                onChange={(separator) => edit({ separator })}
              />
            )}
            <label className="response-field">
              Máximo de itens
              <input
                type="number"
                min={1}
                max={50}
                value={current.limit}
                onChange={(event) => {
                  const limit = Number(event.target.value);
                  if (Number.isInteger(limit)) edit({ limit: Math.min(50, Math.max(1, limit)) });
                }}
              />
            </label>
          </div>
          <div className="designer-grid">
            <TextField
              label="Antes da lista (só com itens)"
              value={current.prefix ?? ''}
              maxLength={200}
              focus={focus}
              onChange={(prefix) => edit({ prefix })}
            />
            <TextField
              label="Depois da lista (só com itens)"
              value={current.suffix ?? ''}
              maxLength={200}
              focus={focus}
              onChange={(suffix) => edit({ suffix })}
            />
          </div>
          <TextField
            label="Quando a lista estiver vazia"
            value={current.empty}
            maxLength={500}
            focus={focus}
            onChange={(empty) => edit({ empty })}
          />
          <TextField
            label="Quando passar do máximo ({rest} restantes de {total})"
            value={current.more}
            maxLength={200}
            focus={focus}
            onChange={(more) => edit({ more })}
          />
        </>
      )}
      <div className="list-preview" aria-label={`Prévia de {${list.name}}`}>
        {preview.trim() ? <DiscordMarkdown text={preview} /> : <small>(vazio)</small>}
      </div>
    </fieldset>
  );
}

export function ListsEditor({
  definition,
  formats,
  onChange,
  scope,
  focus,
  insert,
}: {
  definition: Definition;
  formats: ListFormat[];
  onChange: (formats: ListFormat[]) => void;
  scope: Scope;
  focus: TextFocus;
  insert: (token: string) => void;
}) {
  if (!definition.lists.length)
    return <p className="response-note">Esta resposta não tem listas.</p>;
  return (
    <div className="response-stack">
      {definition.lists.map((list) => (
        <ListCard
          key={list.name}
          list={list}
          format={formats.find((format) => format.source === list.name)}
          scope={scope}
          focus={focus}
          insert={insert}
          onChange={(format) =>
            onChange([
              ...formats.filter((entry) => entry.source !== list.name),
              ...(format ? [format] : []),
            ])
          }
        />
      ))}
    </div>
  );
}
