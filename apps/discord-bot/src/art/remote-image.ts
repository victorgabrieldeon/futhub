import { loadImage } from '@napi-rs/canvas';
import type { Image } from '@napi-rs/canvas';

// Card and pack art repeat across replies; failures are cached too so a dead URL stays cheap.
const imageCache = new Map<string, Promise<Image | undefined>>();

export function remoteImage(url: string): Promise<Image | undefined> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  if (imageCache.size >= 256) {
    const oldest = imageCache.keys().next().value;
    if (oldest) imageCache.delete(oldest);
  }
  const pending = fetch(imageRequestUrl(url), { signal: AbortSignal.timeout(3_000) })
    .then(async (response) => {
      if (!response.ok) return undefined;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 10 * 1024 * 1024) return undefined;
      return loadImage(withoutContentCredentials(Buffer.from(bytes)));
    })
    .catch(() => undefined);
  imageCache.set(url, pending);
  return pending;
}

function imageRequestUrl(value: string): string {
  const publicOrigin = process.env.MINIO_PUBLIC_URL;
  const internalOrigin =
    process.env.MINIO_INTERNAL_URL ??
    (process.env.MINIO_SERVICE_HOST && process.env.MINIO_SERVICE_PORT_API
      ? `http://${process.env.MINIO_SERVICE_HOST}:${process.env.MINIO_SERVICE_PORT_API}`
      : undefined);
  if (!publicOrigin || !internalOrigin) return value;
  try {
    const url = new URL(value);
    if (url.origin !== new URL(publicOrigin).origin) return value;
    return new URL(`${url.pathname}${url.search}`, internalOrigin).toString();
  } catch {
    return value;
  }
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Skia rejects PNGs carrying C2PA content credentials (`caBX`), common in AI-generated art.
function withoutContentCredentials(bytes: Buffer): Buffer {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return bytes;
  const chunks = [bytes.subarray(0, 8)];
  for (let offset = 8; offset + 12 <= bytes.length; ) {
    const end = offset + 12 + bytes.readUInt32BE(offset);
    if (bytes.toString('latin1', offset + 4, offset + 8) !== 'caBX')
      chunks.push(bytes.subarray(offset, end));
    offset = end;
  }
  return Buffer.concat(chunks);
}
