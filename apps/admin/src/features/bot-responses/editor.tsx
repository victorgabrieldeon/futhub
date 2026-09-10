import type {
  BotResponseButtonDto,
  BotResponseDefinitionDto,
  BotResponseEmbedDto,
  BotResponseTemplateDto,
} from '@futhub/api-client';
import { type MutableRefObject, useEffect, useId, useRef } from 'react';
import { type BotResponseComponentDto, moveItem } from './helpers';

export type TextFocus = MutableRefObject<{
  element: HTMLInputElement | HTMLTextAreaElement;
  change: (value: string) => void;
} | null>;

function TextField({
  label,
  value,
  onChange,
  focus,
  multiline = false,
  maxLength,
  pattern,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  focus: TextFocus;
  multiline?: boolean;
  maxLength?: number;
  pattern?: string;
}) {
  const id = useId();
  const element = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (focus.current?.element === element.current && focus.current)
      focus.current.change = onChange;
  });
  const props = {
    id,
    value,
    maxLength,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
    onFocus: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      focus.current = { element: event.currentTarget, change: onChange };
    },
  };
  return (
    <label className="response-field" htmlFor={id}>
      <span>
        {label}
        {maxLength ? (
          <small>
            {value.length}/{maxLength}
          </small>
        ) : null}
      </span>
      {multiline ? (
        <textarea
          {...props}
          ref={(node) => {
            element.current = node;
          }}
          rows={3}
        />
      ) : (
        <input
          {...props}
          pattern={pattern}
          ref={(node) => {
            element.current = node;
          }}
        />
      )}
    </label>
  );
}

function OrderControls({
  index,
  count,
  label,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  label: string;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="response-order">
      <button
        type="button"
        disabled={index === 0}
        aria-label={`Mover ${label} para cima`}
        onClick={() => onMove(-1)}
      >
        Subir
      </button>
      <button
        type="button"
        disabled={index === count - 1}
        aria-label={`Mover ${label} para baixo`}
        onClick={() => onMove(1)}
      >
        Descer
      </button>
      <button type="button" aria-label={`Remover ${label}`} onClick={onRemove}>
        Remover
      </button>
    </div>
  );
}

function ButtonsEditor({
  buttons,
  onChange,
  definition,
  focus,
}: {
  buttons: BotResponseButtonDto[];
  onChange: (buttons: BotResponseButtonDto[]) => void;
  definition: BotResponseDefinitionDto;
  focus: TextFocus;
}) {
  const update = (index: number, patch: Partial<BotResponseButtonDto>) =>
    onChange(buttons.map((button, i) => (i === index ? { ...button, ...patch } : button)));
  return (
    <div className="response-stack">
      <p>Botões: {buttons.length}/5</p>
      {buttons.map((button, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Controlled positional fields; templates have no item IDs.
        <fieldset className="response-block" key={index}>
          <legend>Botão {index + 1}</legend>
          <OrderControls
            index={index}
            count={buttons.length}
            label={`botão ${index + 1}`}
            onMove={(direction) => onChange(moveItem(buttons, index, direction))}
            onRemove={() => onChange(buttons.filter((_, i) => i !== index))}
          />
          <TextField
            label="Rótulo"
            value={button.label}
            maxLength={80}
            focus={focus}
            onChange={(label) => update(index, { label })}
          />
          <label className="response-field">
            Ação
            <select
              aria-label="Ação"
              required
              value={button.action}
              onChange={(event) => {
                const action = event.target.value;
                update(index, { action, style: action === 'link' ? 'link' : 'primary', url: '' });
              }}
            >
              <option value="" disabled>
                Selecione uma ação
              </option>
              {definition.actions.map((action) => (
                <option value={action.id} key={action.id}>
                  {action.label}
                </option>
              ))}
            </select>
          </label>
          <p className="response-note">
            {definition.actions.find((action) => action.id === button.action)?.description ??
              'Ação indisponível. Selecione uma ação do catálogo.'}
          </p>
          <label className="response-field">
            Estilo
            <select
              aria-label="Estilo"
              value={button.style}
              disabled={button.action === 'link'}
              onChange={(event) =>
                update(index, { style: event.target.value as BotResponseButtonDto['style'] })
              }
            >
              {(button.action === 'link'
                ? ['link']
                : ['primary', 'secondary', 'success', 'danger']
              ).map((style) => (
                <option value={style} key={style}>
                  {style}
                </option>
              ))}
            </select>
          </label>
          {button.action === 'link' && (
            <TextField
              label="URL do link (HTTP ou HTTPS)"
              value={button.url}
              maxLength={512}
              focus={focus}
              onChange={(url) => update(index, { url })}
            />
          )}
          <label className="response-check">
            <input
              type="checkbox"
              checked={button.disabled}
              onChange={(event) => update(index, { disabled: event.target.checked })}
            />
            Desabilitado
          </label>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={buttons.length >= 5 || !definition.actions.length}
        onClick={() => {
          const action = definition.actions[0];
          if (action)
            onChange([
              ...buttons,
              {
                action: action.id,
                label: action.label,
                style: action.id === 'link' ? 'link' : 'primary',
                url: '',
                disabled: false,
              },
            ]);
        }}
      >
        Adicionar botão
      </button>
      {!definition.actions.length && (
        <p className="response-note">Nenhuma ação disponível para esta resposta.</p>
      )}
    </div>
  );
}

type Child = Exclude<BotResponseComponentDto, { type: 'container' }>;
const blockLabels = {
  text: 'Texto',
  separator: 'Separador',
  media: 'Mídia',
  row: 'Linha de botões',
  container: 'Container',
};

function newBlock(type: BotResponseComponentDto['type']): BotResponseComponentDto {
  switch (type) {
    case 'text':
      return { type, content: '' };
    case 'separator':
      return { type, spacing: 1, divider: true };
    case 'media':
      return { type, url: '', description: '' };
    case 'row':
      return { type, buttons: [] };
    case 'container':
      return { type, color: '', components: [] };
  }
}

export function ComponentsEditor({
  components,
  onChange,
  definition,
  focus,
  legacy = false,
  nested = false,
}: {
  components: BotResponseComponentDto[];
  onChange: (components: BotResponseComponentDto[]) => void;
  definition: BotResponseDefinitionDto;
  focus: TextFocus;
  legacy?: boolean;
  nested?: boolean;
}) {
  const update = (index: number, component: BotResponseComponentDto) =>
    onChange(components.map((current, i) => (i === index ? component : current)));
  const types: BotResponseComponentDto['type'][] = legacy
    ? ['row']
    : nested
      ? ['text', 'separator', 'media', 'row']
      : ['text', 'separator', 'media', 'row', 'container'];
  return (
    <div className="response-stack">
      {components.map((component, index) => (
        <fieldset className="response-block" key={`${index}-${component.type}`}>
          <legend>
            {blockLabels[component.type]} {index + 1}
          </legend>
          <OrderControls
            index={index}
            count={components.length}
            label={`bloco ${index + 1}`}
            onMove={(direction) => onChange(moveItem(components, index, direction))}
            onRemove={() => onChange(components.filter((_, i) => i !== index))}
          />
          {component.type === 'text' && (
            <TextField
              label="Texto"
              multiline
              maxLength={4000}
              value={component.content}
              focus={focus}
              onChange={(content) => update(index, { ...component, content })}
            />
          )}
          {component.type === 'separator' && (
            <>
              <label className="response-field">
                Espaçamento
                <select
                  value={component.spacing}
                  onChange={(event) =>
                    update(index, { ...component, spacing: Number(event.target.value) as 1 | 2 })
                  }
                >
                  <option value={1}>Pequeno</option>
                  <option value={2}>Grande</option>
                </select>
              </label>
              <label className="response-check">
                <input
                  type="checkbox"
                  checked={component.divider}
                  onChange={(event) =>
                    update(index, { ...component, divider: event.target.checked })
                  }
                />
                Mostrar linha
              </label>
            </>
          )}
          {component.type === 'media' && (
            <>
              <TextField
                label="URL da imagem (HTTP ou HTTPS)"
                value={component.url}
                maxLength={2048}
                focus={focus}
                onChange={(url) => update(index, { ...component, url })}
              />
              <TextField
                label="Descrição da imagem"
                value={component.description}
                maxLength={1024}
                focus={focus}
                onChange={(description) => update(index, { ...component, description })}
              />
            </>
          )}
          {component.type === 'row' && (
            <ButtonsEditor
              buttons={component.buttons}
              definition={definition}
              focus={focus}
              onChange={(buttons) => update(index, { ...component, buttons })}
            />
          )}
          {component.type === 'container' && (
            <>
              <TextField
                label="Cor (#RRGGBB, opcional)"
                pattern="#[0-9a-fA-F]{6}"
                value={component.color}
                focus={focus}
                onChange={(color) => update(index, { ...component, color })}
              />
              <ComponentsEditor
                nested
                components={component.components}
                definition={definition}
                focus={focus}
                onChange={(children) =>
                  update(index, { ...component, components: children as Child[] })
                }
              />
            </>
          )}
        </fieldset>
      ))}
      <div className="response-add" aria-label="Adicionar bloco">
        {types.map((type) => (
          <button
            type="button"
            key={type}
            disabled={components.length >= (legacy ? 5 : 40)}
            onClick={() => onChange([...components, newBlock(type)])}
          >
            + {blockLabels[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

const emptyEmbed: BotResponseEmbedDto = {
  title: '',
  description: '',
  color: '',
  footer: '',
  authorName: '',
  authorUrl: '',
  authorIconUrl: '',
  imageUrl: '',
  thumbnailUrl: '',
  fields: [],
};

export function LegacyEditor({
  template,
  onChange,
  focus,
}: {
  template: BotResponseTemplateDto;
  onChange: (template: BotResponseTemplateDto) => void;
  focus: TextFocus;
}) {
  const update = (index: number, patch: Partial<BotResponseEmbedDto>) =>
    onChange({
      ...template,
      embeds: template.embeds.map((embed, i) => (i === index ? { ...embed, ...patch } : embed)),
    });
  return (
    <div className="response-stack">
      <TextField
        label="Conteúdo"
        value={template.content}
        multiline
        maxLength={2000}
        focus={focus}
        onChange={(content) => onChange({ ...template, content })}
      />
      <h2>
        Embeds <small>{template.embeds.length}/10</small>
      </h2>
      {template.embeds.map((embed, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Controlled positional fields; templates have no item IDs.
        <fieldset className="response-block" key={index}>
          <legend>Embed {index + 1}</legend>
          <OrderControls
            index={index}
            count={template.embeds.length}
            label={`embed ${index + 1}`}
            onMove={(direction) =>
              onChange({ ...template, embeds: moveItem(template.embeds, index, direction) })
            }
            onRemove={() =>
              onChange({ ...template, embeds: template.embeds.filter((_, i) => i !== index) })
            }
          />
          <TextField
            label="Nome do autor (opcional)"
            value={embed.authorName ?? ''}
            maxLength={256}
            focus={focus}
            onChange={(authorName) => update(index, { authorName })}
          />
          <TextField
            label="URL do autor (opcional)"
            value={embed.authorUrl ?? ''}
            maxLength={2048}
            focus={focus}
            onChange={(authorUrl) => update(index, { authorUrl })}
          />
          <TextField
            label="URL do ícone do autor (opcional)"
            value={embed.authorIconUrl ?? ''}
            maxLength={2048}
            focus={focus}
            onChange={(authorIconUrl) => update(index, { authorIconUrl })}
          />
          <TextField
            label="Título"
            value={embed.title}
            maxLength={256}
            focus={focus}
            onChange={(title) => update(index, { title })}
          />
          <TextField
            label="Descrição"
            value={embed.description}
            maxLength={4096}
            multiline
            focus={focus}
            onChange={(description) => update(index, { description })}
          />
          <TextField
            label="Cor (#RRGGBB, opcional)"
            pattern="#[0-9a-fA-F]{6}"
            value={embed.color}
            focus={focus}
            onChange={(color) => update(index, { color })}
          />
          <TextField
            label="Rodapé"
            value={embed.footer}
            maxLength={2048}
            focus={focus}
            onChange={(footer) => update(index, { footer })}
          />
          <TextField
            label="URL da imagem (opcional)"
            value={embed.imageUrl}
            maxLength={2048}
            focus={focus}
            onChange={(imageUrl) => update(index, { imageUrl })}
          />
          <TextField
            label="URL da miniatura (opcional)"
            value={embed.thumbnailUrl}
            maxLength={2048}
            focus={focus}
            onChange={(thumbnailUrl) => update(index, { thumbnailUrl })}
          />
          <h3>
            Campos <small>{embed.fields.length}/25</small>
          </h3>
          {embed.fields.map((field, fieldIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Controlled positional fields; templates have no item IDs.
            <fieldset className="response-block" key={fieldIndex}>
              <legend>Campo {fieldIndex + 1}</legend>
              <OrderControls
                index={fieldIndex}
                count={embed.fields.length}
                label={`campo ${fieldIndex + 1}`}
                onMove={(direction) =>
                  update(index, { fields: moveItem(embed.fields, fieldIndex, direction) })
                }
                onRemove={() =>
                  update(index, { fields: embed.fields.filter((_, i) => i !== fieldIndex) })
                }
              />
              <TextField
                label="Nome"
                value={field.name}
                maxLength={256}
                focus={focus}
                onChange={(name) =>
                  update(index, {
                    fields: embed.fields.map((item, i) =>
                      i === fieldIndex ? { ...item, name } : item,
                    ),
                  })
                }
              />
              <TextField
                label="Valor"
                value={field.value}
                multiline
                maxLength={1024}
                focus={focus}
                onChange={(value) =>
                  update(index, {
                    fields: embed.fields.map((item, i) =>
                      i === fieldIndex ? { ...item, value } : item,
                    ),
                  })
                }
              />
              <label className="response-check">
                <input
                  type="checkbox"
                  checked={field.inline}
                  onChange={(event) =>
                    update(index, {
                      fields: embed.fields.map((item, i) =>
                        i === fieldIndex ? { ...item, inline: event.target.checked } : item,
                      ),
                    })
                  }
                />
                Na mesma linha
              </label>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={embed.fields.length >= 25}
            onClick={() =>
              update(index, { fields: [...embed.fields, { name: '', value: '', inline: false }] })
            }
          >
            Adicionar campo
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={template.embeds.length >= 10}
        onClick={() =>
          onChange({ ...template, embeds: [...template.embeds, { ...emptyEmbed, fields: [] }] })
        }
      >
        Adicionar embed
      </button>
    </div>
  );
}
