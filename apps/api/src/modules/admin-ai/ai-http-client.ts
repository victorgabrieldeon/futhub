import { lookup } from 'node:dns';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { aiSdkFetch } from './ai-sdk-fetch.js';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const)
  blocked.addSubnet(address, prefix, 'ipv6');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

function publicIp(address: string): boolean {
  switch (isIP(address)) {
    case 4:
      return !blocked.check(address, 'ipv4');
    case 6:
      return globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
    default:
      return false;
  }
}

function validateUrl(url: URL): string {
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.href.includes('#')) {
    throw new BadRequestException('AI base URL must use HTTPS without credentials or fragments.');
  }
  if (
    isIP(hostname)
      ? !publicIp(hostname)
      : !hostname.includes('.') ||
        /(^|\.)(localhost|local|internal|invalid|test|example|onion)$|(^|\.)home\.arpa$/i.test(
          hostname,
        )
  ) {
    throw new BadRequestException('AI endpoint must use a public Internet address.');
  }
  return hostname;
}

export function normalizeAiBaseUrl(value: string): string {
  let url: URL;
  try {
    if (!/^https:\/\/[^/?#@]+(?:[/?#]|$)/i.test(value) || /[\s\\]/.test(value))
      throw new Error('Invalid URL syntax');
    url = new URL(value);
  } catch {
    throw new BadRequestException('AI base URL is invalid.');
  }
  validateUrl(url);
  if (url.href.includes('?'))
    throw new BadRequestException('AI base URL must not contain a query.');
  url.pathname =
    url.pathname
      .replace(/\/(?:chat\/completions|responses|messages)\/?$/i, '')
      .replace(/\/+$/, '') || '/v1';
  return url.href;
}

type AiHttpOptions = {
  readonly method: 'GET' | 'POST';
  readonly headers: Record<string, string>;
  readonly body?: string;
  readonly responseType?: 'json' | 'text';
};
type AiHttpResponse = { readonly status: number; readonly body: unknown };

@Injectable()
export class AiHttpClient {
  async request(url: URL, options: AiHttpOptions): Promise<AiHttpResponse> {
    return this.perform(url, options);
  }

  async requestStream(
    url: URL,
    options: AiHttpOptions & {
      readonly onChunk: (chunk: Uint8Array) => void;
      readonly onResponse?: (status: number, headers: Record<string, string>) => void;
    },
  ): Promise<AiHttpResponse> {
    return this.perform(url, options, options.onChunk, options.onResponse);
  }

  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    return aiSdkFetch(this, input, init);
  }

  private async perform(
    url: URL,
    options: AiHttpOptions,
    onChunk?: (chunk: Uint8Array) => void,
    onResponse?: (status: number, headers: Record<string, string>) => void,
  ): Promise<AiHttpResponse> {
    const target = new URL(url.href);
    const hostname = validateUrl(target);
    const body = options.body;
    if (body !== undefined && Buffer.byteLength(body) > 1024 * 1024) {
      throw new BadRequestException('AI request body exceeds 1 MiB.');
    }
    const headers = { ...options.headers, 'accept-encoding': 'identity' };
    return new Promise((resolve, reject) => {
      let settled = false;
      let outgoing: ClientRequest | undefined;
      let incoming: IncomingMessage | undefined;
      const finish = (error: Error | null, result?: AiHttpResponse) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) {
          reject(error);
          incoming?.destroy();
          outgoing?.destroy();
        } else if (result) resolve(result);
      };
      // ponytail: one 30-second deadline includes DNS and streaming; no retries of billable POSTs.
      const timer = setTimeout(
        () => finish(new GatewayTimeoutException('AI provider request timed out.')),
        30_000,
      );
      const connect = (
        addresses: readonly { readonly address: string; readonly family: number }[],
      ) => {
        if (settled) return;
        const pinned = addresses[0];
        if (
          !pinned ||
          addresses.length > 64 ||
          addresses.some(({ address, family }) => !publicIp(address) || isIP(address) !== family)
        ) {
          finish(
            new BadRequestException('AI endpoint must resolve only to public Internet addresses.'),
          );
          return;
        }
        try {
          outgoing = request(
            target,
            {
              method: options.method,
              headers,
              agent: false,
              rejectUnauthorized: true,
              family: pinned.family,
              lookup: (_host, lookupOptions, callback) => {
                if (lookupOptions.all) callback(null, [pinned]);
                else callback(null, pinned.address, pinned.family);
              },
            },
            (response) => {
              if (settled) {
                response.destroy();
                return;
              }
              incoming = response;
              const events: NodeJS.EventEmitter = response;
              const status = response.statusCode ?? 502;
              if (status >= 300 && status < 400) {
                finish(new BadGatewayException('AI provider redirects are not allowed.'));
                return;
              }
              if (
                onChunk &&
                status >= 200 &&
                status < 300 &&
                response.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !==
                  'text/event-stream'
              ) {
                finish(new BadGatewayException('AI provider did not return an event stream.'));
                return;
              }
              try {
                onResponse?.(
                  status,
                  Object.fromEntries(
                    Object.entries(response.headers).flatMap(([name, value]) =>
                      value === undefined
                        ? []
                        : [[name, Array.isArray(value) ? value.join(', ') : value]],
                    ),
                  ),
                );
              } catch {
                finish(new BadGatewayException('AI provider stream processing failed.'));
                return;
              }
              let size = 0;
              const chunks: Buffer[] = [];
              events.on('error', () =>
                finish(new BadGatewayException('AI provider response failed.')),
              );
              events.on('aborted', () =>
                finish(new BadGatewayException('AI provider response was interrupted.')),
              );
              events.on('close', () =>
                finish(new BadGatewayException('AI provider response was interrupted.')),
              );
              events.on('data', (chunk: Buffer) => {
                if (settled) return;
                size += chunk.length;
                if (size > 2 * 1024 * 1024) {
                  finish(new BadGatewayException('AI provider response exceeds 2 MiB.'));
                } else if (status >= 200 && status < 300) {
                  if (!onChunk) chunks.push(chunk);
                  else {
                    try {
                      onChunk(chunk);
                    } catch {
                      finish(new BadGatewayException('AI provider stream processing failed.'));
                    }
                  }
                }
              });
              events.on('end', () => {
                if (settled) return;
                if (onChunk || status < 200 || status >= 300) {
                  finish(null, { status, body: null });
                  return;
                }
                try {
                  const text = Buffer.concat(chunks).toString('utf8');
                  const parsed: unknown = options.responseType === 'text' ? text : JSON.parse(text);
                  finish(null, { status, body: parsed });
                } catch {
                  finish(new BadGatewayException('AI provider returned invalid JSON.'));
                }
              });
            },
          );
          outgoing.on('error', () =>
            finish(new BadGatewayException('AI provider HTTPS connection failed.')),
          );
          outgoing.end(body);
        } catch {
          finish(new BadGatewayException('AI provider HTTPS connection failed.'));
        }
      };
      if (isIP(hostname)) connect([{ address: hostname, family: isIP(hostname) }]);
      else
        lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
          if (error) finish(new BadGatewayException('AI provider DNS lookup failed.'));
          else connect(addresses);
        });
    });
  }
}
