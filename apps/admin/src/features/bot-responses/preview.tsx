import {
  type CanvasImage,
  type RenderedMessage,
  type Scope,
  type Template,
  imageId,
  render,
} from '@futhub/bot-templates';
import { useState } from 'react';
import { CanvasStage } from './canvas-stage';
import { DiscordMarkdown } from './discord-markdown';

// Renders the exact Discord JSON the bot sends, so the preview cannot drift from production.

type Raw = Record<string, unknown>;
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const list = (value: unknown) => (Array.isArray(value) ? (value as Raw[]) : []);
const hex = (value: unknown) =>
  typeof value === 'number' ? `#${value.toString(16).padStart(6, '0')}` : undefined;

function Media({
  url,
  description,
  images,
  scope,
}: {
  url: string;
  description?: string;
  images: CanvasImage[];
  scope: Scope;
}) {
  const [failed, setFailed] = useState(false);
  const id = imageId(url);
  const generated = id ? images.find((image) => image.id === id) : undefined;
  if (generated)
    return (
      <CanvasStage image={generated} scope={scope} className="discord-media canvas-generated" />
    );
  if (failed)
    return (
      <p className="response-image-fallback">{description || 'Imagem'}: prévia indisponível</p>
    );
  return (
    <img
      className="discord-media"
      src={url}
      alt={description ?? ''}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function Buttons({ row }: { row: Raw }) {
  return (
    <div className="response-preview-buttons">
      {list(row.components).map((button, index) => {
        const emoji = button.emoji as { id: string; animated: boolean; name: string } | undefined;
        return (
          <a
            // biome-ignore lint/suspicious/noArrayIndexKey: Stateless preview follows payload order.
            key={index}
            className="response-preview-button"
            data-style="link"
            data-disabled={Boolean(button.disabled)}
            href={text(button.url)}
            target="_blank"
            rel="noreferrer"
          >
            {emoji && (
              <img
                className="discord-emoji"
                alt={`:${emoji.name}:`}
                src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`}
              />
            )}
            {text(button.label)} ↗
          </a>
        );
      })}
    </div>
  );
}

function Components({
  components,
  images,
  scope,
}: {
  components: Raw[];
  images: CanvasImage[];
  scope: Scope;
}) {
  return (
    <>
      {components.map((component, index) => {
        const key = `${index}-${String(component.type)}`;
        switch (component.type) {
          case 10:
            return <DiscordMarkdown key={key} text={text(component.content)} />;
          case 14:
            return (
              <div
                key={key}
                className="response-preview-separator"
                style={{ paddingBlock: component.spacing === 2 ? 16 : 8 }}
              >
                {Boolean(component.divider) && <hr />}
              </div>
            );
          case 12:
            return (
              <div key={key} className="discord-gallery">
                {list(component.items).map((item, i) => (
                  <Media
                    // biome-ignore lint/suspicious/noArrayIndexKey: Stateless preview follows payload order.
                    key={i}
                    url={text((item.media as Raw | undefined)?.url)}
                    description={text(item.description)}
                    images={images}
                    scope={scope}
                  />
                ))}
              </div>
            );
          case 1:
            return <Buttons key={key} row={component} />;
          case 17:
            return (
              <div
                key={key}
                className="response-preview-container"
                style={{ borderLeftColor: hex(component.accent_color) }}
              >
                <Components components={list(component.components)} images={images} scope={scope} />
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

function Embeds({ embeds, images, scope }: { embeds: Raw[]; images: CanvasImage[]; scope: Scope }) {
  return (
    <>
      {embeds.map((embed, index) => {
        const author = embed.author as Raw | undefined;
        const thumbnail = text((embed.thumbnail as Raw | undefined)?.url);
        const image = text((embed.image as Raw | undefined)?.url);
        return (
          <article
            // biome-ignore lint/suspicious/noArrayIndexKey: Stateless preview follows payload order.
            key={index}
            className="response-preview-embed"
            style={{ borderLeftColor: hex(embed.color) }}
          >
            {thumbnail && (
              <div className="response-preview-thumbnail">
                <Media url={thumbnail} images={images} scope={scope} />
              </div>
            )}
            {author && (
              <div className="response-preview-embed-author">
                {text(author.icon_url) && (
                  <Media url={text(author.icon_url)} images={images} scope={scope} />
                )}
                <strong>{text(author.name)}</strong>
              </div>
            )}
            {text(embed.title) && (
              <h3>
                <DiscordMarkdown text={text(embed.title)} />
              </h3>
            )}
            {text(embed.description) && <DiscordMarkdown text={text(embed.description)} />}
            {list(embed.fields).length > 0 && (
              <dl className="response-preview-fields">
                {list(embed.fields).map((field, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Stateless preview follows payload order.
                  <div key={i} data-inline={Boolean(field.inline)}>
                    <dt>
                      <DiscordMarkdown text={text(field.name)} />
                    </dt>
                    <dd>
                      <DiscordMarkdown text={text(field.value)} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {image && <Media url={image} images={images} scope={scope} />}
            {text((embed.footer as Raw | undefined)?.text) && (
              <footer>
                <DiscordMarkdown text={text((embed.footer as Raw).text)} />
              </footer>
            )}
          </article>
        );
      })}
    </>
  );
}

export type ListSimulation = 'examples' | 'empty' | 'many';

export function Preview({
  template,
  scope,
  simulation,
  onSimulation,
  hasLists,
}: {
  template: Template;
  scope: Scope;
  simulation: ListSimulation;
  onSimulation: (value: ListSimulation) => void;
  hasLists: boolean;
}) {
  let rendered: RenderedMessage | undefined;
  let error = '';
  try {
    rendered = render(template, scope);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Não foi possível montar a prévia.';
  }
  const body = rendered?.body;
  return (
    <aside className="response-preview" aria-label="Prévia da resposta">
      <header>
        <p className="eyebrow">Prévia ao vivo</p>
        <h2>Resposta no Discord</h2>
        <p>Gerada pelo mesmo renderizador do bot, com os valores de exemplo do catálogo.</p>
        {hasLists && (
          <label className="response-field">
            Simular listas
            <select
              value={simulation}
              onChange={(event) => onSimulation(event.target.value as ListSimulation)}
            >
              <option value="examples">Exemplos do catálogo</option>
              <option value="empty">Listas vazias</option>
              <option value="many">Listas longas (×12)</option>
            </select>
          </label>
        )}
      </header>
      <div className="response-preview-message">
        <p className="response-preview-author">
          FutHub <small>APP</small>
        </p>
        {error && <output className="form-error">{error} O bot usaria a resposta padrão.</output>}
        {body && (
          <>
            {text(body.content) && <DiscordMarkdown text={text(body.content)} />}
            <Embeds embeds={list(body.embeds)} images={rendered?.images ?? []} scope={scope} />
            <Components
              components={list(body.components)}
              images={rendered?.images ?? []}
              scope={scope}
            />
          </>
        )}
      </div>
    </aside>
  );
}
