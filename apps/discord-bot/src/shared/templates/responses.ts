import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { BotResponseTemplateDto } from '@futhub/api-client';
import type {
  APIActionRowComponent,
  APIButtonComponent,
  APIContainerComponent,
  APIMediaGalleryComponent,
  APISeparatorComponent,
  APITextDisplayComponent,
  InteractionReplyOptions,
} from 'discord.js';

export const noMentions = { parse: [] as never[], repliedUser: false };
const secret = randomBytes(32);
// Buttons intentionally expire on restart; users can issue a fresh command.
const actions = ['lucro.claim', 'pack.shop', 'pack.inspect', 'pack.purchase', 'pack.open'] as const;
export type Action = (typeof actions)[number];
export type Binding = { userId: string; packId?: string; page?: number };
export const isPackId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

function payload(action: string, binding: Binding): string {
  if (!actions.includes(action as Action) || !/^\d{1,20}$/.test(binding.userId))
    throw new Error('Invalid action');
  const arg =
    action === 'pack.shop'
      ? String(binding.page ?? 1)
      : action === 'lucro.claim'
        ? '-'
        : (binding.packId ?? '');
  if (
    action === 'pack.shop'
      ? !/^[1-9]\d{0,8}$/.test(arg)
      : action !== 'lucro.claim' && !isPackId(arg)
  )
    throw new Error('Invalid action argument');
  return `b1:${actions.indexOf(action as Action)}:${binding.userId}:${arg}`;
}

export function actionId(action: string, binding: Binding): string {
  const body = `${payload(action, binding)}:${randomBytes(3).toString('base64url')}`;
  return `${body}:${createHmac('sha256', secret).update(body).digest('base64url').slice(0, 16)}`;
}

export function parseAction(id: string, userId: string): { action: Action; binding: Binding } {
  const [version, index, owner, arg, nonce, signature, extra] = id.split(':');
  const action = actions[Number(index)];
  if (
    id.length > 100 ||
    version !== 'b1' ||
    !/^[0-4]$/.test(index ?? '') ||
    !action ||
    owner !== userId ||
    extra !== undefined
  )
    throw new Error('Invalid button');
  const binding = { userId, ...(action === 'pack.shop' ? { page: Number(arg) } : { packId: arg }) };
  if (!/^[\w-]{4}$/.test(nonce ?? '')) throw new Error('Invalid button');
  const body = `${payload(action, binding)}:${nonce}`;
  const expected = `${body}:${createHmac('sha256', secret).update(body).digest('base64url').slice(0, 16)}`;
  if (
    !signature ||
    expected.length !== id.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(id))
  )
    throw new Error('Invalid button');
  return { action, binding };
}

export function expand(text: string, values: Record<string, string>): string {
  if (typeof text !== 'string') throw new Error('Invalid text');
  // Migrated lucro text may contain literal braces; new templates are validated by the API.
  return text.replace(/\{([^{}]+)\}/g, (token, key: string) =>
    Object.hasOwn(values, key) ? (values[key] ?? '') : token,
  );
}

function bounded(value: string, max: number, required = false): string {
  if (value.length > max || (required && !value.trim())) throw new Error('Discord text limit');
  return value;
}

function color(value: string): number | undefined {
  if (!value) return undefined;
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Invalid color');
  return Number.parseInt(value.slice(1), 16);
}

function url(value: string, max = 2048): string {
  bounded(value, max, true);
  const parsed = new URL(value);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error('Invalid URL');
  return value;
}

export function renderResponse(
  template: BotResponseTemplateDto,
  values: Record<string, string>,
  binding: Binding,
): InteractionReplyOptions {
  const text = (value: string, max: number, required = false) =>
    bounded(expand(value, values), max, required);
  let count = 0;
  let displayLength = 0;
  type Component = BotResponseTemplateDto['components'][number];
  // Only explicitly sendable fields survive; API/admin data is not spread into Discord payloads.
  function component(
    item: Component,
    child = false,
  ):
    | APITextDisplayComponent
    | APISeparatorComponent
    | APIMediaGalleryComponent
    | APIActionRowComponent<APIButtonComponent>
    | APIContainerComponent
    | null {
    count++;
    switch (item.type) {
      case 'text': {
        const content = text(item.content, 4000, true);
        displayLength += content.length;
        return { type: 10, content };
      }
      case 'separator':
        if (![1, 2].includes(item.spacing) || typeof item.divider !== 'boolean')
          throw new Error('Invalid separator');
        return { type: 14, spacing: item.spacing, divider: item.divider };
      case 'media': {
        const image = expand(item.url, values);
        if (!image.trim()) {
          count--;
          return null;
        }
        return {
          type: 12,
          items: [
            { media: { url: url(image) }, description: text(item.description, 1024) || undefined },
          ],
        };
      }
      case 'row':
        if (!item.buttons.length || item.buttons.length > 5) throw new Error('Invalid row');
        return {
          type: 1,
          components: item.buttons.map((button): APIButtonComponent => {
            count++;
            const label = text(button.label, 80, true);
            if (typeof button.disabled !== 'boolean') throw new Error('Invalid button');
            if (button.action === 'link' && button.style === 'link')
              return {
                type: 2,
                style: 5,
                label,
                url: url(expand(button.url, values), 512),
                disabled: button.disabled,
              };
            const style = (
              { primary: 1, secondary: 2, success: 3, danger: 4 } as Record<string, 1 | 2 | 3 | 4>
            )[button.style];
            if (!style || button.action === 'link' || button.url)
              throw new Error('Invalid button action');
            return {
              type: 2,
              style,
              label,
              custom_id: actionId(button.action, binding),
              disabled: button.disabled,
            };
          }),
        };
      case 'container': {
        if (child) throw new Error('Nested container');
        const children = item.components
          .map((entry) => component(entry, true))
          .filter((entry) => entry !== null)
          .map((entry) => {
            if (entry.type === 17) throw new Error('Nested container');
            return entry;
          });
        if (!children.length || children.length > 39) throw new Error('Invalid container');
        return { type: 17, accent_color: color(expand(item.color, values)), components: children };
      }
      default:
        throw new Error('Unsupported component');
    }
  }
  const components = template.components
    .map((item) => component(item))
    .filter((item) => item !== null);
  if (template.mode === 'components_v2') {
    if (
      template.content ||
      template.embeds.length ||
      !components.length ||
      count > 40 ||
      displayLength > 4000
    )
      throw new Error('Invalid V2 message');
    return { flags: 32768, components, allowedMentions: noMentions };
  }
  if (
    template.mode !== 'legacy' ||
    template.components.some((item) => item.type !== 'row') ||
    components.length > 5 ||
    template.embeds.length > 10
  )
    throw new Error('Invalid legacy message');
  let embedLength = 0;
  const embeds = template.embeds.map((embed) => {
    const title = text(embed.title, 256);
    const description = text(embed.description, 4096);
    const footer = text(embed.footer, 2048);
    const authorName = text(embed.authorName ?? '', 256);
    const authorUrl = expand(embed.authorUrl ?? '', values).trim();
    const authorIconUrl = expand(embed.authorIconUrl ?? '', values).trim();
    if (!authorName && (authorUrl || authorIconUrl)) throw new Error('Author name required');
    if (embed.fields.length > 25) throw new Error('Too many fields');
    const fields = embed.fields.map((field) => {
      if (typeof field.inline !== 'boolean') throw new Error('Invalid field');
      return {
        name: text(field.name, 256, true),
        value: text(field.value, 1024, true),
        inline: field.inline,
      };
    });
    embedLength +=
      title.length +
      description.length +
      footer.length +
      authorName.length +
      fields.reduce((n, field) => n + field.name.length + field.value.length, 0);
    const image = expand(embed.imageUrl, values).trim();
    const thumbnail = expand(embed.thumbnailUrl, values).trim();
    if (!title && !description && !footer && !authorName && !fields.length && !image && !thumbnail)
      throw new Error('Empty embed');
    return {
      title: title || undefined,
      description: description || undefined,
      color: color(expand(embed.color, values)),
      author: authorName
        ? {
            name: authorName,
            url: authorUrl ? url(authorUrl) : undefined,
            icon_url: authorIconUrl ? url(authorIconUrl) : undefined,
          }
        : undefined,
      footer: footer ? { text: footer } : undefined,
      fields,
      image: image ? { url: url(image) } : undefined,
      thumbnail: thumbnail ? { url: url(thumbnail) } : undefined,
    };
  });
  const content = text(template.content, 2000);
  if (embedLength > 6000 || (!content.trim() && !embeds.length && !components.length))
    throw new Error('Invalid message');
  return { content: content || undefined, embeds, components, allowedMentions: noMentions };
}

export function safeResponse(
  template: BotResponseTemplateDto | undefined,
  values: Record<string, string>,
  binding: Binding,
  fallback: string,
): InteractionReplyOptions {
  try {
    if (template) return renderResponse(template, values, binding);
  } catch {
    /* Invalid expanded templates must not turn committed rewards into failures. */
  }
  return { content: fallback.slice(0, 2000), allowedMentions: noMentions };
}
