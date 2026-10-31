import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app';
import type { Drivers } from './commands/dispatcher';
import { DEFAULT_PROJECT_DIR } from './config';
import { loadProjectStore, type ProjectStore } from './project/store';

let store: ProjectStore;
beforeAll(async () => {
  store = await loadProjectStore(DEFAULT_PROJECT_DIR);
});

// inject() sends a request straight to the app: no port, no network, fast and parallel-safe.
const get = (url: string, headers: Record<string, string> = {}) =>
  buildApp({ store }).inject({ method: 'GET', url, headers });

describe('buildApp', () => {
  it('answers the health check', async () => {
    const response = await get('/api/health');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('returns 404 for an unknown route', async () => {
    expect((await get('/api/nothing')).statusCode).toBe(404);
  });

  it('serves the project with its revision', async () => {
    const response = await get('/api/project');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ revision: 1, project: store.project });
  });

  describe('saving the project (PUT /api/project)', () => {
    // Saving writes to disk, so these tests work on a copy of the demo stand.
    const dirs: string[] = [];
    afterEach(async () => {
      await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
    });
    async function appOnCopy() {
      const dir = await mkdtemp(join(tmpdir(), 'tapcue-app-'));
      dirs.push(dir);
      await cp(DEFAULT_PROJECT_DIR, dir, { recursive: true });
      const copy = await loadProjectStore(dir);
      return { app: buildApp({ store: copy }), copy, dir };
    }
    const put = (app: ReturnType<typeof buildApp>, payload: unknown) =>
      app.inject({ method: 'PUT', url: '/api/project', payload: payload as object });

    it('saves a valid project and answers its new revision', async () => {
      const { app, dir } = await appOnCopy();
      const changed = { ...store.project, name: 'Renamed stand' };

      const response = await put(app, changed);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ revision: 2 });
      expect((await app.inject({ method: 'GET', url: '/api/project' })).json()).toEqual({
        revision: 2,
        project: changed,
      });
      const onDisk = JSON.parse(await readFile(join(dir, 'project.json'), 'utf8')) as unknown;
      expect(onDisk).toEqual(changed);
    });

    it('refuses an invalid project with 400 and the field errors, and saves nothing', async () => {
      const { app, copy } = await appOnCopy();

      const response = await put(app, { ...store.project, name: '' });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ errors: [{ path: 'name', message: 'Expected a name' }] });
      expect(copy.revision).toBe(1);
      expect(copy.project.name).toBe('Demo stand');
    });

    it('tells every player and editor the new revision, and only after a save (spec PLY-5)', async () => {
      const { app } = await appOnCopy();
      await app.listen({ port: 0, host: '127.0.0.1' });
      try {
        const base = `127.0.0.1:${(app.server.address() as AddressInfo).port}`;
        const received = { player: [] as unknown[], editor: [] as unknown[] };
        const open = async (who: keyof typeof received) => {
          const socket = new WebSocket(`ws://${base}/ws`);
          socket.addEventListener('message', (event) =>
            received[who].push(JSON.parse(String(event.data))),
          );
          await new Promise((resolve) => socket.addEventListener('open', resolve));
          return socket;
        };
        const player = await open('player');
        player.send(JSON.stringify({ type: 'hello', stationId: 'main' }));
        const editor = await open('editor');
        const save = (project: unknown) =>
          fetch(`http://${base}/api/project`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(project),
          });

        expect((await save({ ...store.project, name: '' })).status).toBe(400);
        expect((await save({ ...store.project, name: 'Renamed stand' })).status).toBe(200);

        const updated = { type: 'project-updated', revision: 2 };
        await vi.waitFor(() => {
          expect(received.player).toEqual([updated]);
          expect(received.editor).toEqual([updated]);
        });
        player.close();
        editor.close();
      } finally {
        await app.close();
      }
    });

    it('refuses a body that is not JSON, and saves nothing', async () => {
      const { app, copy } = await appOnCopy();
      const response = await app.inject({
        method: 'PUT',
        url: '/api/project',
        headers: { 'content-type': 'application/json' },
        payload: '{ "schemaVersion": 1, ',
      });
      expect(response.statusCode).toBe(400);
      expect(copy.revision).toBe(1);
    });
  });

  describe('assets', () => {
    const file = (name: string) => readFile(join(DEFAULT_PROJECT_DIR, 'assets', name));

    it('serves an image with its type and size', async () => {
      const response = await get('/assets/home.jpg');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(response.rawPayload).toEqual(await file('home.jpg'));
    });

    it('serves a video and announces that it accepts byte ranges', async () => {
      const response = await get('/assets/about-loop.mp4');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('video/mp4');
      expect(response.headers['accept-ranges']).toBe('bytes');
    });

    it('answers a Range request with exactly those bytes (Safari needs this for video)', async () => {
      const video = await file('about-loop.mp4');
      const response = await get('/assets/about-loop.mp4', { range: 'bytes=100-199' });
      expect(response.statusCode).toBe(206);
      expect(response.headers['content-range']).toBe(`bytes 100-199/${video.length}`);
      expect(response.rawPayload).toEqual(video.subarray(100, 200));
    });

    it('returns 404 for a file that does not exist', async () => {
      expect((await get('/assets/nothing.jpg')).statusCode).toBe(404);
    });

    it.each([
      '/assets/../project.json',
      '/assets/%2e%2e/project.json',
      '/assets/..%2fproject.json',
    ])('never serves files outside the assets folder: %s', async (url) => {
      const response = await get(url);
      expect(response.statusCode).not.toBe(200);
      expect(response.body).not.toContain('schemaVersion');
    });
  });

  it('sends the command of a tap that arrives over /ws, with the driver of its target', async () => {
    const sent: string[] = [];
    const fake = (name: string) => ({
      send: () => {
        sent.push(name);
        return Promise.resolve();
      },
      close: () => Promise.resolve(),
    });
    const drivers: Drivers = { 'osc-udp': fake('osc-udp'), udp: fake('udp'), http: fake('http') };
    const app = buildApp({ store, drivers });
    await app.listen({ port: 0, host: '127.0.0.1' });
    try {
      const port = (app.server.address() as AddressInfo).port;
      const player = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      await new Promise((resolve) => player.addEventListener('open', resolve));
      player.send(JSON.stringify({ type: 'hello', stationId: 'main' }));
      // "Call our team" on Home sends an HTTP command to the demo receiver.
      player.send(JSON.stringify({ type: 'tap', pageId: 'p_home00', hotspotId: 'h_call00' }));
      await vi.waitFor(() => expect(sent).toEqual(['http']));
      player.close();
    } finally {
      await app.close();
    }
  });

  it('shows a request to the demo receiver to viewers on /ws (spec DEMO-1)', async () => {
    const app = buildApp({ store });
    await app.listen({ port: 0, host: '127.0.0.1' });
    try {
      const port = (app.server.address() as AddressInfo).port;
      const viewer = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      const received: unknown[] = [];
      viewer.addEventListener('message', (event) => received.push(JSON.parse(String(event.data))));
      await new Promise((resolve) => viewer.addEventListener('open', resolve));
      const response = await fetch(`http://127.0.0.1:${port}/demo/screen-1/product-a`, {
        method: 'POST',
      });
      expect(response.status).toBe(200);
      await vi.waitFor(() =>
        expect(received).toContainEqual({
          type: 'demo-received',
          request: expect.objectContaining({ screen: 'screen-1', content: 'product-a' }) as unknown,
        }),
      );
      viewer.close();
    } finally {
      await app.close();
    }
  });
});
