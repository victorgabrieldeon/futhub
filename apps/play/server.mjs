import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import staticPlugin from '@fastify/static';
import Fastify from 'fastify';

const apiUrl = process.env.PLAYER_API_URL;
if (!apiUrl) throw new Error('PLAYER_API_URL is required.');

const app = Fastify({ logger: true });
await app.register(staticPlugin, {
  root: fileURLToPath(new URL('./dist', import.meta.url)),
  index: false,
  wildcard: false,
});
app.removeContentTypeParser('application/json');
app.addContentTypeParser('application/json', (request, payload, done) => done(null, payload));
app.addContentTypeParser('*', (request, payload, done) => done(null, payload));
app.all('/v1/*', proxyApiRequest);
app.get('/*', (_request, reply) => reply.type('text/html').sendFile('index.html'));

await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3000) });

async function proxyApiRequest(request, reply) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || ['connection', 'host', 'transfer-encoding'].includes(name)) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : request.body;
  let response;
  try {
    response = await fetch(new URL(request.raw.url ?? '/', apiUrl), {
      method: request.method,
      headers,
      body,
      ...(body ? { duplex: 'half' } : {}),
    });
  } catch {
    return reply.status(502).send({ message: 'Não foi possível conectar à API.' });
  }

  for (const name of ['cache-control', 'content-disposition', 'content-length', 'content-type']) {
    const value = response.headers.get(name);
    if (value) reply.header(name, value);
  }
  for (const cookie of response.headers.getSetCookie()) reply.header('set-cookie', cookie);
  if (!response.body) return reply.status(response.status).send();
  return reply.status(response.status).send(Readable.fromWeb(response.body));
}
