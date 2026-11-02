import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { DEFAULT_PROJECT_DIR } from './config';
import { loadProjectStore } from './project/store';

const INDEX = '<!doctype html><title>Tapcue</title><div id="root"></div>';

const dirs: string[] = [];
const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A server with a small stand-in for packages/web/dist, or with an empty folder (`built: false`). */
async function start({ built = true } = {}) {
  const webDir = await mkdtemp(join(tmpdir(), 'tapcue-web-'));
  dirs.push(webDir);
  if (built) {
    await writeFile(join(webDir, 'index.html'), INDEX);
    await writeFile(join(webDir, 'manifest.webmanifest'), '{"name":"Tapcue"}');
    await mkdir(join(webDir, 'static'));
    await writeFile(join(webDir, 'static', 'index-Zo85DJRN.js'), 'console.log("app")');
  }
  const store = await loadProjectStore(DEFAULT_PROJECT_DIR);
  const app = buildApp({ store, webDir });
  apps.push(app);
  return app;
}

const get = (app: FastifyInstance, url: string, method: 'GET' | 'HEAD' | 'POST' = 'GET') =>
  app.inject({ method, url });

describe('the web app build (spec NFR-6, ED-11)', () => {
  it.each(['/', '/edit/pages', '/edit/settings', '/play/main', '/play/small?x=1', '/demo'])(
    'answers index.html for the page %s, never cached',
    async (url) => {
      const response = await get(await start(), url);
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.body).toBe(INDEX);
    },
  );

  it('serves hashed scripts and styles to be cached for good', async () => {
    const response = await get(await start(), '/static/index-Zo85DJRN.js');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('console.log("app")');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('serves other files of the build, such as the manifest, checked on every visit', async () => {
    const response = await get(await start(), '/manifest.webmanifest');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('{"name":"Tapcue"}');
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('leaves the API, the project files and the demo receiver as they are', async () => {
    const app = await start();
    expect((await get(app, '/api/health')).json()).toEqual({ ok: true });
    expect((await get(app, '/assets/home.jpg')).headers['content-type']).toBe('image/jpeg');
    const demo = await get(app, '/demo/screen-1/product-a', 'POST');
    expect(demo.statusCode).toBe(200);
    expect(demo.headers['content-type']).not.toMatch(/html/);
  });

  it.each([
    ['GET', '/api/nothing'],
    ['GET', '/assets/missing.jpg'],
    ['POST', '/edit/pages'],
  ] as const)('answers %s %s with a JSON 404, not the app', async (method, url) => {
    const response = await get(await start(), url, method);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Not Found', message: `${method} ${url} not found` });
  });

  it('says how to build the app when there is no build, and the API still works', async () => {
    const app = await start({ built: false });
    const response = await get(app, '/edit/pages');
    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(
      'The Tapcue web app is not built yet. Run "npm run build" and restart the server, or use "npm run dev" for development.',
    );
    expect((await get(app, '/api/health')).json()).toEqual({ ok: true });
  });
});
