import { type BotEmoji, type Scope, expand, findEmoji } from './expand.js';
import type {
  CanvasImage,
  Definition,
  Template,
  TemplateComponent,
  TemplateData,
} from './types.js';

export const IMAGE_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const imageRef = (id: string) => `attachment://${id}.png`;
export function imageId(value: string): string | undefined {
  const id = /^attachment:\/\/([^/]+)\.png$/.exec(value)?.[1];
  return id && IMAGE_ID.test(id) ? id : undefined;
}

export function httpUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) &&
      url.hostname &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function createScope(
  template: Pick<Template, 'lists'>,
  data: TemplateData,
  definition?: Definition,
  emojis: readonly BotEmoji[] = [],
): Scope {
  return {
    data,
    emojis: new Map(
      emojis.flatMap((emoji) => [
        [emoji.name, emoji],
        [emoji.name.toLowerCase(), emoji],
      ]),
    ),
    formats: template.lists ?? [],
    fallback: (source) => definition?.lists.find((list) => list.name === source)?.defaultFormat,
  };
}

/** Catalog examples as runtime data, used by previews and save-time validation. */
export function exampleData(definition: Definition): TemplateData {
  const data: TemplateData = {};
  for (const variable of definition.variables) data[variable.token.slice(1, -1)] = variable.example;
  for (const list of definition.lists) data[list.name] = list.examples.map((item) => ({ ...item }));
  return data;
}

export class TemplateRenderError extends Error {}

type Json = Record<string, unknown>;
export type RenderedMessage = {
  /** Raw Discord message JSON (snake_case), ready for an interaction reply. */
  body: Json & { allowed_mentions: { parse: never[] } };
  /** Generated images referenced by the message; attach each as `<id>.png`. */
  images: CanvasImage[];
};

/**
 * Expands a template into a Discord payload. `strict` rejects anything over Discord limits
 * (save-time); otherwise text is truncated and broken optional media is dropped (runtime).
 */
export function render(
  template: Template,
  scope: Scope,
  { strict = false }: { strict?: boolean } = {},
): RenderedMessage {
  const fail = (message: string): never => {
    throw new TemplateRenderError(message);
  };
  const fit = (value: string, max: number, what: string): string => {
    if (value.length <= max) return value;
    if (strict) fail(`${what} passa de ${max} caracteres com os valores de exemplo.`);
    return `${value.slice(0, max - 3)}...`;
  };
  const text = (value: string, max: number, what: string) => fit(expand(value, scope), max, what);
  const images = new Map((template.images ?? []).map((image) => [image.id, image]));
  const used = new Map<string, CanvasImage>();
  const media = (value: string, what: string): string | undefined => {
    const expanded = expand(value, scope).trim();
    if (!expanded) return undefined;
    const id = imageId(expanded);
    const generated = id ? images.get(id) : undefined;
    if (generated) {
      used.set(generated.id, generated);
      return imageRef(generated.id);
    }
    const url = httpUrl(expanded);
    if (strict && (!url || url.length > 2048))
      fail(`${what}: use uma URL HTTP(S) de até 2048 caracteres ou uma imagem gerada.`);
    return url && url.length <= 2048 ? url : undefined;
  };
  const link = (value: string, what: string): string | undefined => {
    const url = httpUrl(expand(value, scope).trim());
    if (strict && (!url || url.length > 512))
      fail(`${what}: use uma URL HTTP(S) válida de até 512 caracteres.`);
    return url && url.length <= 512 ? url : undefined;
  };

  let displayText = 0;
  let count = 0;
  // Separators and empty containers alone are not a message.
  let visible = false;
  const component = (item: TemplateComponent): Json | null => {
    switch (item.type) {
      case 'text': {
        let content = expand(item.content, scope);
        if (!content.trim()) {
          if (strict) fail('Blocos de texto não podem ficar vazios.');
          return null;
        }
        const budget = 4000 - displayText;
        if (content.length > budget) {
          if (strict) fail('Os textos somam mais de 4000 caracteres com os valores de exemplo.');
          if (budget < 4) return null;
          content = `${content.slice(0, budget - 3)}...`;
        }
        displayText += content.length;
        count++;
        visible = true;
        return { type: 10, content };
      }
      case 'separator':
        count++;
        return { type: 14, spacing: item.spacing, divider: item.divider };
      case 'media': {
        const url = media(item.url, 'Mídia');
        if (!url) return null;
        count++;
        visible = true;
        const description = text(item.description, 1024, 'A descrição da mídia');
        return { type: 12, items: [{ media: { url }, ...(description ? { description } : {}) }] };
      }
      case 'row': {
        const buttons = item.buttons.flatMap((button) => {
          // Only link buttons have runtime behavior; other stored actions are ignored.
          if (button.action !== 'link' || button.style !== 'link') {
            if (strict) fail('Somente botões de link estão disponíveis.');
            return [];
          }
          const url = link(button.url, `Botão "${button.label}"`);
          const label = text(button.label, 80, 'O rótulo do botão');
          if (!url || !label.trim()) return [];
          const emoji = button.emoji ? findEmoji(scope, button.emoji) : undefined;
          const fallback = button.emoji && !emoji ? scope.emojiFallback?.(button.emoji) : undefined;
          return [
            {
              type: 2,
              style: 5,
              label,
              url,
              disabled: button.disabled,
              ...(emoji
                ? { emoji: { id: emoji.id, name: emoji.name, animated: emoji.animated } }
                : fallback
                  ? { emoji: { name: fallback } }
                  : {}),
            },
          ];
        });
        if (!buttons.length) return null;
        count += 1 + buttons.length;
        visible = true;
        return { type: 1, components: buttons.slice(0, 5) };
      }
      case 'container': {
        const children = item.components.map(component).filter((child) => child !== null);
        if (!children.length) return null;
        count++;
        const color = colorNumber(item.color);
        return {
          type: 17,
          ...(color === undefined ? {} : { accent_color: color }),
          components: children,
        };
      }
    }
  };
  const components = template.components.map(component).filter((item) => item !== null);
  if (count > 40) fail('A mensagem passa de 40 componentes.');

  if (template.mode === 'components_v2') {
    if (!visible) fail('A mensagem ficou vazia.');
    return {
      body: { flags: 32768, components, allowed_mentions: { parse: [] } },
      images: [...used.values()],
    };
  }

  let embedText = 0;
  const embeds = template.embeds.flatMap((embed) => {
    const title = text(embed.title, 256, 'O título do embed');
    const description = text(embed.description, 4096, 'A descrição do embed');
    const footer = text(embed.footer, 2048, 'O rodapé do embed');
    const authorName = text(embed.authorName ?? '', 256, 'O autor do embed');
    const fields = embed.fields
      .map((field) => ({
        name: text(field.name, 256, 'O nome do campo'),
        value: text(field.value, 1024, 'O valor do campo'),
        inline: field.inline,
      }))
      .filter((field) => {
        if (field.name.trim() && field.value.trim()) return true;
        if (strict) fail('Campos do embed não podem ficar vazios.');
        return false;
      })
      .slice(0, 25);
    const image = media(embed.imageUrl, 'Imagem do embed');
    const thumbnail = media(embed.thumbnailUrl, 'Miniatura do embed');
    const authorIcon = authorName ? media(embed.authorIconUrl ?? '', 'Ícone do autor') : undefined;
    const authorUrl =
      authorName && embed.authorUrl?.trim() ? link(embed.authorUrl, 'Link do autor') : undefined;
    embedText +=
      title.length +
      description.length +
      footer.length +
      authorName.length +
      fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0);
    if (
      !title.trim() &&
      !description.trim() &&
      !footer.trim() &&
      !authorName.trim() &&
      !fields.length &&
      !image &&
      !thumbnail
    ) {
      if (strict) fail('Embeds não podem ficar vazios.');
      return [];
    }
    const color = colorNumber(embed.color);
    return [
      {
        ...(title.trim() ? { title } : {}),
        ...(description.trim() ? { description } : {}),
        ...(color === undefined ? {} : { color }),
        ...(authorName.trim()
          ? {
              author: {
                name: authorName,
                ...(authorUrl ? { url: authorUrl } : {}),
                ...(authorIcon ? { icon_url: authorIcon } : {}),
              },
            }
          : {}),
        ...(footer.trim() ? { footer: { text: footer } } : {}),
        ...(fields.length ? { fields } : {}),
        ...(image ? { image: { url: image } } : {}),
        ...(thumbnail ? { thumbnail: { url: thumbnail } } : {}),
      },
    ];
  });
  if (embedText > 6000) fail('O conjunto de embeds passa de 6000 caracteres.');
  const content = text(template.content, 2000, 'O conteúdo');
  if (!content.trim() && !embeds.length && !visible) fail('A mensagem ficou vazia.');
  return {
    body: {
      ...(content.trim() ? { content } : {}),
      embeds: embeds.slice(0, 10),
      components,
      allowed_mentions: { parse: [] },
    },
    images: [...used.values()],
  };
}

export function colorNumber(value: string): number | undefined {
  return /^#[0-9a-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : undefined;
}
