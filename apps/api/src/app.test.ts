import { afterAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

const app = buildApp();

afterAll(async () => app.close());

describe('GET /health', () => {
  it('returns service status', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
