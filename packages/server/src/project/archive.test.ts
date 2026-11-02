import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import yauzl from 'yauzl';
import yazl from 'yazl';
import { buildApp } from '../app';
import { DEFAULT_PROJECT_DIR } from '../config';
import { archiveName } from './archive';
import { loadProjectStore } from './store';

describe('archiveName', () => {
  it.each([
    ['Demo stand', 'demo-stand.zip'],
    ['  Stand: Hall 4 / 2026!  ', 'stand-hall-4-2026.zip'],
    ['Выставка', 'project.zip'],
  ])('%s → %s', (name, expected) => expect(archiveName(name)).toBe(expected));
});

// Imports replace files, so each test works on its own copies of the demo stand.
const dirs: string[] = [];
const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function start(maxBytes?: number) {
  const dir = await mkdtemp(join(tmpdir(), 'tapcue-archive-'));
  dirs.push(dir);
  await cp(DEFAULT_PROJECT_DIR, dir, { recursive: true });
  const store = await loadProjectStore(dir);
  const app = buildApp({ store, archive: maxBytes === undefined ? {} : { maxBytes } });
  apps.push(app);
  return { dir, store, app };
}

/** Every file of a project folder, assets as a hash of their bytes, to compare two folders. */
async function snapshot(dir: string) {
  const hash = async (file: string) =>
    createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  const files: Record<string, unknown> = {};
  // Parsed: a save writes the same project with its own formatting.
  files['project.json'] = JSON.parse(await readFile(join(dir, 'project.json'), 'utf8'));
  for (const name of (await readdir(join(dir, 'assets'))).sort()) {
    files[`assets/${name}`] = await hash(join(dir, 'assets', name));
  }
  return { files, all: (await readdir(dir)).sort() };
}

async function exportZip(app: FastifyInstance): Promise<Buffer> {
  const response = await app.inject({ method: 'GET', url: '/api/project/export' });
  expect(response.statusCode).toBe(200);
  return response.rawPayload;
}

/** The entries of a .zip: name → bytes. */
async function unzip(zip: Buffer): Promise<Record<string, Buffer>> {
  const archive = await yauzl.fromBufferPromise(zip, { lazyEntries: true });
  const files: Record<string, Buffer> = {};
  await new Promise<void>((resolve, reject) => {
    archive.on('entry', (entry: yauzl.Entry) => {
      void archive.openReadStreamPromise(entry).then(async (stream) => {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(chunk as Buffer);
        files[entry.fileName] = Buffer.concat(chunks);
        archive.readEntry();
      }, reject);
    });
    archive.on('end', resolve).on('error', reject);
    archive.readEntry();
  });
  return files;
}

/**
 * A .zip made with yazl from name → contents; a name ending in "/" is a folder entry. `compress`
 * for a small archive that unpacks big.
 */
async function makeZip(entries: [string, string | Buffer][], compress = false): Promise<Buffer> {
  const zip = new yazl.ZipFile();
  for (const [name, content] of entries) {
    if (name.endsWith('/')) zip.addEmptyDirectory(name);
    else zip.addBuffer(Buffer.from(content), name, { compress });
  }
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream as Readable) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

const importZip = (app: FastifyInstance, zip: Buffer, type = 'application/zip') =>
  app.inject({
    method: 'POST',
    url: '/api/project/import',
    headers: { 'content-type': type },
    payload: zip,
  });

describe('GET /api/project/export (spec PRJ-3)', () => {
  it('downloads project.json and every asset, named after the project', async () => {
    const { app, dir, store } = await start();
    const response = await app.inject({ method: 'GET', url: '/api/project/export' });

    expect(response.headers['content-type']).toBe('application/zip');
    expect(response.headers['content-disposition']).toBe('attachment; filename="demo-stand.zip"');
    const files = await unzip(response.rawPayload);
    expect(Object.keys(files)).toEqual([
      'project.json',
      'assets/about-loop.mp4',
      'assets/home.jpg',
      'assets/product-a.jpg',
      'assets/product-b.jpg',
    ]);
    expect(JSON.parse(files['project.json']!.toString('utf8'))).toEqual(store.project);
    expect(files['assets/home.jpg']).toEqual(await readFile(join(dir, 'assets', 'home.jpg')));
  });

  it('leaves out files the project format cannot name, and folders', async () => {
    const { app, dir } = await start();
    await writeFile(join(dir, 'assets', 'my photo.jpg'), 'x');
    await mkdir(join(dir, 'assets', 'old'));
    await writeFile(join(dir, 'assets', 'old', 'home.jpg'), 'x');
    const files = await unzip(await exportZip(app));
    expect(Object.keys(files)).not.toContain('assets/my photo.jpg');
    expect(Object.keys(files).filter((name) => name.startsWith('assets/old'))).toEqual([]);
  });
});

describe('POST /api/project/import (spec PRJ-4)', () => {
  it('replaces the project and its files with the exported ones', async () => {
    const source = await start();
    const zip = await exportZip(source.app);
    // The target is a different project: renamed, with one asset more and one less.
    const target = await start();
    await target.store.save({ ...target.store.project, name: 'Another stand' });
    await writeFile(join(target.dir, 'assets', 'extra.png'), 'extra');
    await rm(join(target.dir, 'assets', 'product-b.jpg'));

    const response = await importZip(target.app, zip);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ revision: 3 });
    expect(target.store.project).toEqual(source.store.project);
    expect((await snapshot(target.dir)).files).toEqual((await snapshot(source.dir)).files);
    // Nothing of the import is left next to the project.
    expect((await readdir(target.dir)).sort()).toEqual([
      'README.md',
      'assets',
      'make-assets',
      'project.json',
    ]);
    const served = await target.app.inject({ method: 'GET', url: '/assets/product-b.jpg' });
    expect(served.statusCode).toBe(200);
  });

  it('accepts an archive with a folder entry for assets/, as Finder and zip tools write', async () => {
    const source = await start();
    const files = await unzip(await exportZip(source.app));
    const zip = await makeZip([['assets/', ''], ...Object.entries(files)]);
    const target = await start();
    const response = await importZip(target.app, zip);
    expect(response.statusCode).toBe(200);
    expect((await snapshot(target.dir)).files).toEqual((await snapshot(source.dir)).files);
  });

  it('tells every player and editor the new revision', async () => {
    const { app, store } = await start();
    const zip = await exportZip(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const base = `127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const received: unknown[] = [];
    const player = new WebSocket(`ws://${base}/ws`);
    player.addEventListener('message', (event) => received.push(JSON.parse(String(event.data))));
    await new Promise((resolve) => player.addEventListener('open', resolve));
    player.send(JSON.stringify({ type: 'hello', stationId: 'main' }));

    const response = await fetch(`http://${base}/api/project/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: new Uint8Array(zip),
    });

    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(received).toEqual([{ type: 'project-updated', revision: 2 }]));
    expect(store.revision).toBe(2);
    player.close();
  });

  describe('refuses an archive and changes nothing', () => {
    async function expectRefused(
      zip: Buffer,
      status: number,
      body: unknown,
      options: { maxBytes?: number; type?: string } = {},
    ) {
      const { app, dir, store } = await start(options.maxBytes);
      const before = await snapshot(dir);
      const project = store.project;

      const response = await importZip(app, zip, options.type);

      expect(response.statusCode).toBe(status);
      expect(response.json()).toEqual(body);
      expect(store.revision).toBe(1);
      expect(store.project).toBe(project);
      expect(await snapshot(dir)).toEqual(before);
    }
    const json = (project: unknown) => JSON.stringify(project);
    const demo = async () =>
      JSON.parse(await readFile(join(DEFAULT_PROJECT_DIR, 'project.json'), 'utf8')) as {
        name: string;
      };
    const demoAssets = async (): Promise<[string, Buffer][]> =>
      Promise.all(
        (await readdir(join(DEFAULT_PROJECT_DIR, 'assets'))).map(
          async (name): Promise<[string, Buffer]> => [
            `assets/${name}`,
            await readFile(join(DEFAULT_PROJECT_DIR, 'assets', name)),
          ],
        ),
      );

    it('without project.json', async () => {
      await expectRefused(await makeZip(await demoAssets()), 400, {
        errors: [{ path: 'project.json', message: 'the archive has no project.json at its root' }],
      });
    });

    it('with project.json inside a folder', async () => {
      await expectRefused(await makeZip([['demo-stand/project.json', json(await demo())]]), 400, {
        errors: [
          {
            path: 'demo-stand/project.json',
            message: 'only project.json and files in assets/ can be imported',
          },
        ],
      });
    });

    it('with an invalid project', async () => {
      const project = { ...(await demo()), name: '' };
      await expectRefused(
        await makeZip([['project.json', json(project)], ...(await demoAssets())]),
        400,
        {
          errors: [{ path: 'name', message: 'Expected a name' }],
        },
      );
    });

    it('with project.json that is not JSON', async () => {
      const zip = await makeZip([['project.json', '{ "schemaVersion": 1, ']]);
      const { app } = await start();
      const response = await importZip(app, zip);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        errors: [
          { path: 'project.json', message: expect.stringMatching(/^not valid JSON: /) as string },
        ],
      });
    });

    it('with a referenced file missing', async () => {
      const assets = (await demoAssets()).filter(([name]) => name !== 'assets/home.jpg');
      await expectRefused(await makeZip([['project.json', json(await demo())], ...assets]), 400, {
        errors: [
          { path: 'pages[0].background.asset', message: 'file "assets/home.jpg" does not exist' },
        ],
      });
    });

    it('with a path that leaves the folder', async () => {
      // yazl refuses to write "..", so a same-length name is written and patched in both headers.
      const zip = await makeZip([
        ['project.json', json(await demo())],
        ['xx/evil.png', 'evil'],
      ]);
      const patched = Buffer.from(
        zip.toString('latin1').replaceAll('xx/evil.png', '../evil.png'),
        'latin1',
      );
      await expectRefused(patched, 400, {
        errors: [
          { path: 'archive', message: 'cannot be read: invalid relative path: ../evil.png' },
        ],
      });
    });

    it('with a file outside assets/', async () => {
      await expectRefused(
        await makeZip([
          ['project.json', json(await demo())],
          ['notes.txt', 'hi'],
        ]),
        400,
        {
          errors: [
            {
              path: 'notes.txt',
              message: 'only project.json and files in assets/ can be imported',
            },
          ],
        },
      );
    });

    it('with a file twice', async () => {
      await expectRefused(
        await makeZip([
          ['project.json', json(await demo())],
          ['project.json', json(await demo())],
        ]),
        400,
        { errors: [{ path: 'project.json', message: 'is in the archive twice' }] },
      );
    });

    it('that is not a .zip', async () => {
      await expectRefused(Buffer.from('not a zip at all'), 400, {
        errors: [{ path: 'archive', message: 'not a .zip file' }],
      });
    });

    it('that is not sent as application/zip', async () => {
      await expectRefused(
        await makeZip([['project.json', json(await demo())]]),
        415,
        {
          error: 'Expected a .zip file (application/zip)',
        },
        { type: 'text/plain' },
      );
    });

    it('that is larger than the limit', async () => {
      const zip = await exportZip((await start()).app);
      await expectRefused(
        zip,
        413,
        { error: expect.stringMatching(/^Imports are limited to \d+ MB$/) as string },
        { maxBytes: zip.length - 1 },
      );
    });

    it('that unpacks to more than the limit', async () => {
      // 100 kB of zeros compress to a few hundred bytes.
      const zip = await makeZip(
        [
          ['project.json', json(await demo())],
          ['assets/zeros.png', Buffer.alloc(100_000)],
        ],
        true,
      );
      expect(zip.length).toBeLessThan(50_000);
      await expectRefused(
        zip,
        400,
        {
          errors: [
            {
              path: 'archive',
              message: expect.stringMatching(/^Imports are limited to \d+ MB$/) as string,
            },
          ],
        },
        { maxBytes: 50_000 },
      );
    });
  });
});
