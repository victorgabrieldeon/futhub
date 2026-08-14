import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get('/health', () => ({ status: 'ok' }));

  return app;
}
