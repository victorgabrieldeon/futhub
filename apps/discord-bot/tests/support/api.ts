import { configureApiClient } from '@futhub/api-client';
import { definition } from '@futhub/bot-templates';

export type ApiRequest = Readonly<{
  method: string;
  path: string;
  body: unknown;
}>;

export type MockApi = Readonly<{
  requests: readonly ApiRequest[];
  urls: readonly string[];
}>;

export function mockApi(
  responseBody: unknown | ((request: ApiRequest) => unknown),
  status = 200,
): MockApi {
  const requests: ApiRequest[] = [];
  const urls: string[] = [];

  configureApiClient({
    baseUrl: 'https://api.test',
    token: 'test-token',
    fetch: async (input, init) => {
      const url = input instanceof Request ? new URL(input.url) : new URL(input.toString());
      const request = {
        method: init?.method ?? 'GET',
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      };
      requests.push(request);
      urls.push(`${url.pathname}${url.search}`);
      return Response.json(
        typeof responseBody === 'function' ? responseBody(request) : responseBody,
        { status },
      );
    },
  });

  return { requests, urls };
}

/** Answers bot response GETs with `templates` (or the catalog default) and everything else with `body`. */
export function withTemplates(
  body: unknown,
  templates: Record<string, unknown> = {},
): (request: ApiRequest) => unknown {
  return (request) => {
    const key = /^\/v1\/bot-responses\/(.+)$/.exec(request.path)?.[1];
    if (!key) return body;
    return templates[key] ?? definition(key)?.defaultTemplate;
  };
}

/** Every text the player reads in a reply: content plus Components V2 text displays. */
export function messageText(
  message: { content?: unknown; components?: unknown } | undefined,
): string {
  const out: string[] = [];
  if (typeof message?.content === 'string' && message.content) out.push(message.content);
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const value =
      'toJSON' in node && typeof node.toJSON === 'function' ? (node.toJSON() as unknown) : node;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const record = value as Record<string, unknown>;
    if (record.type === 10 && typeof record.content === 'string') out.push(record.content);
    for (const child of Object.values(record)) if (typeof child === 'object') visit(child);
  };
  visit(message?.components);
  return out.join('\n');
}

/** Labels and custom IDs of every button in a reply. */
export function messageButtons(
  message: { components?: unknown } | undefined,
): { label: string; customId: string; disabled: boolean; style: number }[] {
  const out: { label: string; customId: string; disabled: boolean; style: number }[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const value =
      'toJSON' in node && typeof node.toJSON === 'function' ? (node.toJSON() as unknown) : node;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const record = value as Record<string, unknown>;
    if (record.type === 2)
      out.push({
        label: String(record.label ?? ''),
        customId: String(record.custom_id ?? ''),
        disabled: record.disabled === true,
        style: Number(record.style),
      });
    for (const child of Object.values(record)) if (typeof child === 'object') visit(child);
  };
  visit(message?.components);
  return out;
}
