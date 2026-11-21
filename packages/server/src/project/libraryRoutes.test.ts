import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProjectList } from '@tapcue/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BASED_ON_HEADER, buildApp } from '../app';
import { DEFAULT_PROJECT_DIR } from '../config';
import { ACTIVE_FILE, createLibrary, TRASH_DIR } from './library';
import { loadProjectStore, type ProjectStore } from './store';

// A library of two copies of the demo stand: "alpha" is open, "beta" is named "Beta stand".
let root: string;
let store: ProjectStore;
let app: ReturnType<typeof buildApp>;

async function setUp({ demo = false } = {}) {
  root = await mkdtemp(join(tmpdir(), 'tapcue-routes-'));
  for (const id of ['alpha', 'beta']) {
    await cp(DEFAULT_PROJECT_DIR, join(root, id), { recursive: true });
  }
  const betaFile = join(root, 'beta', 'project.json');
  const beta = JSON.parse(await readFile(betaFile, 'utf8')) as { name: string };
  await writeFile(betaFile, JSON.stringify({ ...beta, name: 'Beta stand' }));
  await writeFile(join(root, 'beta', 'assets', 'only-in-beta.png'), 'beta');
  store = await loadProjectStore(join(root, 'alpha'));
  app = buildApp({ store, library: createLibrary(root), demo });
}
beforeEach(() => setUp());
afterEach(async () => {
  await app.close();
  await rm(root, { recursive: true, force: true });
});

const inject = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) =>
  app.inject({ method, url, ...(payload ? { payload } : {}) });

describe('GET /api/projects (PRJ-5)', () => {
  it('lists the projects and says which one is active', async () => {
    const response = await inject('GET', '/api/projects');

    expect(response.statusCode).toBe(200);
    const list = response.json<ProjectList>();
    expect(list.active).toEqual({ id: 'alpha', name: 'Demo stand' });
    expect(list.projects.map(({ id, active }) => ({ id, active }))).toEqual(
      expect.arrayContaining([
        { id: 'alpha', active: true },
        { id: 'beta', active: false },
      ]),
    );
    expect(list.projects).toHaveLength(2);
  });

  it('has no id for an active project outside the library', async () => {
    const outside = buildApp({
      store: await loadProjectStore(DEFAULT_PROJECT_DIR),
      library: createLibrary(root),
    });
    const list = (
      await outside.inject({ method: 'GET', url: '/api/projects' })
    ).json<ProjectList>();
    expect(list.active).toEqual({ id: null, name: 'Demo stand' });
    expect(list.projects.some((entry) => entry.active)).toBe(false);
  });
});

describe('POST /api/projects (PRJ-6)', () => {
  it('creates an empty project and answers its id', async () => {
    const response = await inject('POST', '/api/projects', {
      name: 'Hall B',
      width: 1920,
      height: 1080,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id: 'hall-b' });
    const list = (await inject('GET', '/api/projects')).json<ProjectList>();
    expect(list.projects).toContainEqual(
      expect.objectContaining({
        id: 'hall-b',
        ok: true,
        name: 'Hall B',
        width: 1920,
        height: 1080,
      }),
    );
    expect(store.project.name).toBe('Demo stand'); // created, not opened
  });

  it('refuses a bad name or size with the field errors', async () => {
    const response = await inject('POST', '/api/projects', { name: '', width: 0, height: 9000 });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      errors: [
        { path: 'name', message: 'Expected a name' },
        { path: 'width', message: 'Expected at least 1 px' },
        { path: 'height', message: 'Expected at most 8192 px' },
      ],
    });
    expect((await readdir(root)).sort()).toEqual(['alpha', 'beta']);
  });
});

describe('POST /api/projects/:id/open (PRJ-7)', () => {
  it('makes the project active, remembers it and serves its files', async () => {
    const response = await inject('POST', '/api/projects/beta/open');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ revision: 2 });
    const current = (await inject('GET', '/api/project')).json<{
      revision: number;
      project: { name: string };
    }>();
    expect(current.revision).toBe(2);
    expect(current.project.name).toBe('Beta stand');
    expect(JSON.parse(await readFile(join(root, ACTIVE_FILE), 'utf8'))).toEqual({ active: 'beta' });
    const asset = await inject('GET', '/assets/only-in-beta.png');
    expect(asset.statusCode).toBe(200);
    expect(asset.body).toBe('beta');
  });

  it('puts uploads into the project that is open now', async () => {
    await inject('POST', '/api/projects/beta/open');
    await app.listen({ port: 0, host: '127.0.0.1' });
    const port = (app.server.address() as AddressInfo).port;
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'logo.png');

    const response = await fetch(`http://127.0.0.1:${port}/api/assets`, {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(201);
    const { asset } = (await response.json()) as { asset: string };
    expect(await readdir(join(root, 'beta', 'assets'))).toContain(asset.replace('assets/', ''));
    expect(await readdir(join(root, 'alpha', 'assets'))).not.toContain(
      asset.replace('assets/', ''),
    );
  });

  it('leaves the active project as it is when it is opened again', async () => {
    const response = await inject('POST', '/api/projects/alpha/open');
    expect(response.json()).toEqual({ revision: 1 });
    expect(store.revision).toBe(1);
  });

  it('answers 404 for a project the library does not list', async () => {
    for (const id of ['nope', '.trash']) {
      const response = await inject('POST', `/api/projects/${encodeURIComponent(id)}/open`);
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: `There is no project "${id}" in the library` });
    }
  });

  it('refuses a project that does not load, with its errors, and keeps the open one', async () => {
    await writeFile(join(root, 'beta', 'project.json'), '{ not json');

    const response = await inject('POST', '/api/projects/beta/open');

    expect(response.statusCode).toBe(400);
    expect(response.json<{ errors: { path: string }[] }>().errors[0]?.path).toBe('project.json');
    expect(store.project.name).toBe('Demo stand');
    expect(await readdir(root)).not.toContain(ACTIVE_FILE);
  });

  it('refuses an editor save made before the switch, and takes one made after (ADR 0021)', async () => {
    await inject('POST', '/api/projects/beta/open'); // revision 2
    const put = (revision: string) =>
      app.inject({
        method: 'PUT',
        url: '/api/project',
        headers: { [BASED_ON_HEADER]: revision },
        payload: { ...store.project, name: `Based on ${revision}` },
      });

    const stale = await put('1');
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({
      error: 'Another project was opened since this copy was loaded',
    });
    expect(store.project.name).toBe('Beta stand');

    const fresh = await put('2');
    expect(fresh.statusCode).toBe(200);
    expect(store.project.name).toBe('Based on 2');
  });

  it('tells every connection, and starts the faders over from their start', async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
    const port = (app.server.address() as AddressInfo).port;
    const player = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const received: unknown[] = [];
    player.addEventListener('message', (event) => received.push(JSON.parse(String(event.data))));
    await new Promise((resolve) => player.addEventListener('open', resolve));
    player.send(JSON.stringify({ type: 'hello', stationId: 'main' }));
    // The demo stand's Volume fader starts at 60; move it to 80 first.
    player.send(
      JSON.stringify({
        type: 'value',
        pageId: 'p_proda0',
        hotspotId: 'h_avol00',
        value: 80,
        final: true,
      }),
    );
    await vi.waitFor(() =>
      expect(received).toContainEqual({ type: 'fader-values', values: { h_avol00: 80 } }),
    );
    received.length = 0;

    await inject('POST', '/api/projects/beta/open');

    await vi.waitFor(() =>
      expect(received).toEqual([
        { type: 'project-updated', revision: 2 },
        { type: 'fader-values', values: { h_avol00: 60 } },
      ]),
    );
    player.close();
  });
});

describe('DELETE /api/projects/:id (PRJ-8)', () => {
  it('moves the project into .trash/', async () => {
    const response = await inject('DELETE', '/api/projects/beta');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect((await readdir(root)).sort()).toEqual([TRASH_DIR, 'alpha']);
    expect(await readdir(join(root, TRASH_DIR))).toEqual([expect.stringMatching(/^beta-/)]);
  });

  it('refuses to delete the active project', async () => {
    const response = await inject('DELETE', '/api/projects/alpha');

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'This project is open on every station: open another one first',
    });
    expect((await readdir(root)).sort()).toEqual(['alpha', 'beta']);
  });

  it('answers 404 for a project the library does not list', async () => {
    const response = await inject('DELETE', '/api/projects/nope');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'There is no project "nope" in the library' });
  });
});

describe('in demo mode (spec DEMO-3)', () => {
  beforeEach(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
    await setUp({ demo: true });
  });

  it('lists the projects but refuses to create, open or delete one', async () => {
    expect((await inject('GET', '/api/projects')).statusCode).toBe(200);
    const refused = [
      await inject('POST', '/api/projects', { name: 'Mine', width: 800, height: 600 }),
      await inject('POST', '/api/projects/beta/open'),
      await inject('DELETE', '/api/projects/beta'),
    ];
    for (const response of refused) {
      expect(response.statusCode).toBe(403);
    }
    expect((await readdir(root)).sort()).toEqual(['alpha', 'beta']);
    expect(store.project.name).toBe('Demo stand');
  });
});
