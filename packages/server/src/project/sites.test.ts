import { randomBytes } from 'node:crypto';
import { cp, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { SitePath } from '@tapcue/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import yazl from 'yazl';
import { buildApp } from '../app';
import { DEFAULT_PROJECT_DIR } from '../config';
import { isSafeRelativePath, isSiteEntry, siteName } from './sites';
import { loadProjectStore } from './store';

describe('siteName', () => {
  it.each([
    ['Product Catalog v2.zip', 'product-catalog-v2-3f9a1c2b'],
    ['catalog.ZIP', 'catalog-3f9a1c2b'],
    ['C:\\fakepath\\Hall B.zip', 'hall-b-3f9a1c2b'],
    ['../../evil.zip', 'evil-3f9a1c2b'],
    ['Каталог.zip', 'site-3f9a1c2b'],
    [`${'a'.repeat(100)}.zip`, `${'a'.repeat(60)}-3f9a1c2b`],
  ])('%s → %s', (original, expected) => {
    const name = siteName(original, '3f9a1c2b');
    expect(name).toBe(expected);
    // Every name it makes is a valid site path in the project format.
    expect(SitePath.safeParse(`assets/sites/${name}`).success).toBe(true);
  });
});

describe('isSafeRelativePath', () => {
  it.each(['index.html', 'img/a.png', 'a/b/c.js', '.well-known/x', 'a..b.html'])(
    'takes %s',
    (path) => expect(isSafeRelativePath(path)).toBe(true),
  );

  it.each(['', '/etc/passwd', '../x', 'a/../../x', 'a/./b', 'a//b', 'a\\b', 'C:x', 'a\0b'])(
    'refuses %j',
    (path) => expect(isSafeRelativePath(path)).toBe(false),
  );
});

describe('isSiteEntry', () => {
  it.each([
    'assets/sites/',
    'assets/sites/catalog/',
    'assets/sites/catalog/index.html',
    'assets/sites/catalog/img/',
    'assets/sites/Hall_B-2/img/a.png',
  ])('takes %s', (name) => expect(isSiteEntry(name)).toBe(true));

  it.each([
    'assets/sites',
    'assets/sites/index.html',
    'assets/sites/my.site/index.html',
    'assets/sites/catalog/../x',
    'assets/sites/catalog//x',
    'assets/catalog/index.html',
    'sites/catalog/index.html',
  ])('refuses %s', (name) => expect(isSiteEntry(name)).toBe(false));
});

describe('POST /api/sites (spec PG-7)', () => {
  // Uploads write files, so each test works on its own copy of the demo stand.
  const dirs: string[] = [];
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function start(sites: { maxBytes?: number; maxUnpackedBytes?: number } = {}) {
    const dir = await mkdtemp(join(tmpdir(), 'tapcue-sites-'));
    dirs.push(dir);
    await cp(DEFAULT_PROJECT_DIR, dir, { recursive: true });
    const store = await loadProjectStore(dir);
    app = buildApp({ store, sites: { suffix: () => '3f9a1c2b', ...sites } });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    /** Everything in assets/sites/, uploads in progress included. */
    const sitesFolder = async () => {
      try {
        return (await readdir(join(dir, 'assets', 'sites'))).sort();
      } catch {
        return [];
      }
    };
    return { dir, base, store, sitesFolder };
  }

  /** A .zip from name → contents; `mode` marks an entry as a link. */
  async function makeZip(entries: [string, string, number?][]): Promise<Buffer> {
    const zip = new yazl.ZipFile();
    for (const [name, content, mode] of entries) {
      if (name.endsWith('/')) zip.addEmptyDirectory(name);
      else zip.addBuffer(Buffer.from(content), name, mode === undefined ? {} : { mode });
    }
    zip.end();
    const chunks: Buffer[] = [];
    for await (const chunk of zip.outputStream as Readable) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  async function upload(base: string, zip: Buffer, name = 'Catalog.zip', type = 'application/zip') {
    const form = new FormData();
    form.append('file', new Blob([zip], { type }), name);
    const response = await fetch(`${base}/api/sites`, { method: 'POST', body: form });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  const site: [string, string][] = [
    ['index.html', '<h1>Catalog</h1><img src="img/a.png">'],
    ['img/a.png', 'png'],
    ['app.js', 'console.log(1)'],
  ];

  it('unpacks a site into assets/sites/ and serves it from /assets/', async () => {
    const { dir, base, sitesFolder } = await start();
    const response = await upload(base, await makeZip(site));
    expect(response).toEqual({ status: 201, body: { site: 'assets/sites/catalog-3f9a1c2b' } });
    // Nothing of the upload is left next to the site.
    expect(await sitesFolder()).toEqual(['catalog-3f9a1c2b']);
    const folder = join(dir, 'assets/sites/catalog-3f9a1c2b');
    expect((await readdir(folder, { recursive: true })).sort()).toEqual([
      'app.js',
      'img',
      'img/a.png',
      'index.html',
    ]);
    const page = await fetch(`${base}/assets/sites/catalog-3f9a1c2b/index.html`);
    expect(page.headers.get('content-type')).toMatch(/^text\/html/);
    expect(await page.text()).toBe('<h1>Catalog</h1><img src="img/a.png">');
    const image = await fetch(`${base}/assets/sites/catalog-3f9a1c2b/img/a.png`);
    expect(image.headers.get('content-type')).toBe('image/png');
    const script = await fetch(`${base}/assets/sites/catalog-3f9a1c2b/app.js`);
    expect(script.headers.get('content-type')).toMatch(/javascript/);
  });

  it('makes a site the project can use as a background', async () => {
    const { base, store } = await start();
    const { body } = await upload(base, await makeZip(site));
    const [home, ...rest] = store.project.pages;
    const page = { ...home!, background: { type: 'web' as const, site: body['site'] as string } };
    expect((await store.save({ ...store.project, pages: [page, ...rest] })).ok).toBe(true);
  });

  it('takes the site out of the one top folder a zipped folder has, without macOS files', async () => {
    const { dir, base } = await start();
    const zip = await makeZip([
      ['catalog/', ''],
      ...site.map(([name, content]): [string, string] => [`catalog/${name}`, content]),
      ['catalog/.DS_Store', 'junk'],
      ['__MACOSX/catalog/._index.html', 'junk'],
    ]);
    expect((await upload(base, zip)).status).toBe(201);
    expect(
      (await readdir(join(dir, 'assets/sites/catalog-3f9a1c2b'), { recursive: true })).sort(),
    ).toEqual(['app.js', 'img', 'img/a.png', 'index.html']);
  });

  it('accepts the name Windows browsers give a .zip', async () => {
    const { base } = await start();
    const response = await upload(
      base,
      await makeZip(site),
      'a.zip',
      'application/x-zip-compressed',
    );
    expect(response.status).toBe(201);
  });

  it('never replaces a site, even when the random part of the name repeats', async () => {
    const { dir, base } = await start();
    expect((await upload(base, await makeZip(site))).status).toBe(201);
    const second = await upload(base, await makeZip([['index.html', 'other']]));
    expect(second.status).toBe(500);
    expect(await readFile(join(dir, 'assets/sites/catalog-3f9a1c2b/index.html'), 'utf8')).toBe(
      '<h1>Catalog</h1><img src="img/a.png">',
    );
  });

  describe('refuses, and keeps nothing,', () => {
    async function expectRefused(
      zip: Buffer,
      status: number,
      error: string,
      options: { name?: string; type?: string; maxBytes?: number; maxUnpackedBytes?: number } = {},
    ) {
      const { base, sitesFolder } = await start(options);
      const response = await upload(base, zip, options.name, options.type);
      expect(response).toEqual({ status, body: { error } });
      expect(await sitesFolder()).toEqual([]);
    }

    it.each([
      ['another extension', 'catalog.rar', 'application/zip'],
      ['another type', 'catalog.zip', 'text/html'],
    ])('a file with %s', async (_, name, type) => {
      await expectRefused(await makeZip(site), 415, 'Expected a .zip file', { name, type });
    });

    it('a file that is not a .zip', async () => {
      await expectRefused(Buffer.from('not a zip at all'), 400, 'not a .zip file');
    });

    it('a site without index.html', async () => {
      await expectRefused(
        await makeZip([['home.html', 'x']]),
        400,
        'the archive has no index.html at its root or in one top folder',
      );
    });

    it('a site whose index.html is deeper than one top folder', async () => {
      await expectRefused(
        await makeZip([['a/b/index.html', 'x']]),
        400,
        'the archive has no index.html at its root or in one top folder',
      );
    });

    it('two top folders, though one has an index.html', async () => {
      await expectRefused(
        await makeZip([
          ['a/index.html', 'x'],
          ['b/other.html', 'y'],
        ]),
        400,
        'the archive has no index.html at its root or in one top folder',
      );
    });

    it.each([
      ['a path that leaves the folder', 'xx/evil.html', '../evil.html'],
      ['an absolute path', 'xetc/passwd', '/etc/passwd'],
    ])('%s', async (_, written, patchedName) => {
      // yazl refuses to write these, so a same-length name is written and patched in both headers.
      const zip = await makeZip([...site, [written, 'evil']]);
      const patched = Buffer.from(
        zip.toString('latin1').replaceAll(written, patchedName),
        'latin1',
      );
      await expectRefused(patched, 400, `"${patchedName}" is outside the site's folder`);
    });

    it('a link', async () => {
      await expectRefused(
        await makeZip([...site, ['secret', '/etc/passwd', 0o120777]]),
        400,
        '"secret" is a link; only files and folders can be used',
      );
    });

    it('a site that unpacks to more than the limit', async () => {
      await expectRefused(
        await makeZip([
          ['index.html', 'a'.repeat(600)],
          ['b.js', 'b'.repeat(600)],
        ]),
        400,
        `unpacked, a site is limited to ${1000 / 1024 / 1024} MB`,
        { maxUnpackedBytes: 1000 },
      );
    });

    it('a file over the upload limit', async () => {
      // Random bytes do not compress, so the .zip itself is over the limit.
      const zip = await makeZip([['index.html', randomBytes(2000).toString('base64')]]);
      await expectRefused(zip, 413, `Files are limited to ${1000 / 1024 / 1024} MB`, {
        maxBytes: 1000,
      });
    });
  });

  it('takes a site of exactly the unpacked limit', async () => {
    const { base } = await start({ maxUnpackedBytes: 1200 });
    const zip = await makeZip([
      ['index.html', 'a'.repeat(600)],
      ['b.js', 'b'.repeat(600)],
    ]);
    expect((await upload(base, zip)).status).toBe(201);
  });

  it('serves nothing outside the assets folder through a site path', async () => {
    const { base } = await start();
    await upload(base, await makeZip(site));
    const response = await fetch(
      `${base}/assets/sites/catalog-3f9a1c2b/%2e%2e/%2e%2e/%2e%2e/project.json`,
    );
    expect(response.status).not.toBe(200);
  });
});
