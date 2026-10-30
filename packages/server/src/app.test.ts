import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
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
});
