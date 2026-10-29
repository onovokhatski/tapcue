import { describe, expect, it } from 'vitest';
import { buildApp } from './app';

describe('buildApp', () => {
  it('answers the health check', async () => {
    // inject() sends a request straight to the app: no port, no network, fast and parallel-safe.
    const response = await buildApp().inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('returns 404 for an unknown route', async () => {
    const response = await buildApp().inject({ method: 'GET', url: '/api/nothing' });
    expect(response.statusCode).toBe(404);
  });
});
