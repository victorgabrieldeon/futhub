import type { AiHttpClient } from './ai-http-client.js';

type HttpMethod = 'GET' | 'POST';
type HttpOptions = Readonly<{
  method: HttpMethod;
  headers: Record<string, string>;
  body?: string;
}>;

function method(value: string): HttpMethod {
  if (value === 'GET' || value === 'POST') return value;
  throw new TypeError(`Unsupported AI HTTP method: ${value}`);
}

function responseBody(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function streams(headers: Headers, body: string | undefined): boolean {
  if (headers.get('accept')?.includes('text/event-stream')) return true;
  if (!body) return false;
  try {
    const value: unknown = JSON.parse(body);
    return (
      typeof value === 'object' && value !== null && 'stream' in value && value.stream === true
    );
  } catch {
    return false;
  }
}

function streamResponse(client: AiHttpClient, url: URL, options: HttpOptions): Promise<Response> {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
  });
  return new Promise((resolve, reject) => {
    let opened = false;
    void client
      .requestStream(url, {
        ...options,
        onChunk: (chunk) => controller?.enqueue(chunk),
        onResponse: (status, headers) => {
          opened = true;
          resolve(new Response(body, { status, headers }));
        },
      })
      .then(({ status }) => {
        if (!opened) resolve(new Response(body, { status }));
        controller?.close();
      })
      .catch((error: unknown) => {
        if (opened) controller?.error(error);
        else reject(error);
      });
  });
}

export async function aiSdkFetch(
  client: AiHttpClient,
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(input, init);
  const headers = Object.fromEntries(request.headers.entries());
  const body = request.body ? await request.text() : undefined;
  const options: HttpOptions = {
    method: method(request.method),
    headers,
    ...(body === undefined ? {} : { body }),
  };
  if (streams(request.headers, body)) {
    return streamResponse(client, new URL(request.url), options);
  }
  const response = await client.request(new URL(request.url), options);
  return new Response(
    response.status >= 200 && response.status < 300 ? responseBody(response.body) : null,
    {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    },
  );
}
