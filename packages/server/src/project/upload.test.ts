import { cp, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AssetPath } from '@tapcue/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { DEFAULT_PROJECT_DIR } from '../config';
import { loadProjectStore } from './store';
import { assetName, MAX_UPLOAD_BYTES } from './upload';

describe('assetName', () => {
  it.each([
    ['Hero Shot (final).JPG', 'hero-shot-final-3f9a1c2b.jpg'],
    ['product-a.png', 'product-a-3f9a1c2b.png'],
    ['C:\\fakepath\\Stand Loop.mp4', 'stand-loop-3f9a1c2b.mp4'],
    ['../../evil.png', 'evil-3f9a1c2b.png'],
    ['Привет.webp', 'file-3f9a1c2b.webp'],
    [`${'a'.repeat(100)}.jpg`, `${'a'.repeat(60)}-3f9a1c2b.jpg`],
  ])('%s → %s', (original, expected) => {
    const name = assetName(original, '3f9a1c2b');
    expect(name).toBe(expected);
    // Every name it makes is a valid asset path in the project format.
    expect(AssetPath.safeParse(`assets/${name}`).success).toBe(true);
  });
});

describe('POST /api/assets', () => {
  // Uploads write files, so each test works on its own copy of the demo stand.
  const dirs: string[] = [];
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function start(upload: { maxBytes?: number; suffix?: () => string } = {}) {
    const dir = await mkdtemp(join(tmpdir(), 'tapcue-upload-'));
    dirs.push(dir);
    await cp(DEFAULT_PROJECT_DIR, dir, { recursive: true });
    const store = await loadProjectStore(dir);
    app = buildApp({ store, upload });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const before = await readdir(join(dir, 'assets'));
    /** Files added to assets/ since the server started. */
    const added = async () =>
      (await readdir(join(dir, 'assets'))).filter((name) => !before.includes(name));
    return { dir, base, store, added };
  }

  const bytes = (length: number) => new Uint8Array(length).map((_, i) => i % 251);

  async function upload(base: string, name: string, type: string, content: Uint8Array) {
    const form = new FormData();
    form.append('file', new Blob([content], { type }), name);
    const response = await fetch(`${base}/api/assets`, { method: 'POST', body: form });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  it('stores an image under a safe unique name and serves it from /assets/', async () => {
    const { base, added } = await start();
    const content = bytes(5000);

    const response = await upload(base, 'Hero Shot.JPG', 'image/jpeg', content);

    expect(response.status).toBe(201);
    const [name] = await added();
    expect(name).toMatch(/^hero-shot-[0-9a-f]{8}\.jpg$/);
    expect(response.body).toEqual({ asset: `assets/${name}`, type: 'image' });
    const served = await fetch(`${base}/assets/${name}`);
    expect(served.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(content);
  });

  it('reports a video as a video', async () => {
    const { base } = await start();
    const response = await upload(base, 'loop.mp4', 'video/mp4', bytes(100));
    expect(response.status).toBe(201);
    expect(response.body['type']).toBe('video');
  });

  it('never overwrites: two uploads with the same name get two files', async () => {
    const { base, added } = await start();
    const first = await upload(base, 'home.jpg', 'image/jpeg', bytes(10));
    const second = await upload(base, 'home.jpg', 'image/jpeg', bytes(20));
    expect(first.body['asset']).not.toBe(second.body['asset']);
    expect(await added()).toHaveLength(2);
    // The demo stand's own home.jpg is untouched.
    expect(await added()).not.toContain('home.jpg');
  });

  it('never replaces a file, even when the random part of the name repeats', async () => {
    const { dir, base } = await start({ suffix: () => 'aaaaaaaa' });
    const first = await upload(base, 'home.jpg', 'image/jpeg', bytes(10));
    const second = await upload(base, 'home.jpg', 'image/jpeg', bytes(20));
    expect(first.status).toBe(201);
    expect(second.status).toBe(500);
    expect(new Uint8Array(await readFile(join(dir, 'assets', 'home-aaaaaaaa.jpg')))).toEqual(
      bytes(10),
    );
  });

  it('keeps a name with a path inside assets/', async () => {
    const { dir, base, added } = await start();
    const before = await readdir(dir);
    const response = await upload(base, '../evil.png', 'image/png', bytes(10));
    expect(response.status).toBe(201);
    expect(await added()).toEqual([expect.stringMatching(/^evil-[0-9a-f]{8}\.png$/)]);
    expect(await readdir(dir)).toEqual(before);
  });

  it.each([
    ['a format the player does not show', 'anim.gif', 'image/gif'],
    ['a type that does not match the extension', 'photo.jpg', 'text/html'],
    ['a file without an extension', 'photo', 'image/jpeg'],
  ])('refuses %s with 415, and stores nothing', async (_, name, type) => {
    const { base, added } = await start();
    const response = await upload(base, name, type, bytes(10));
    expect(response).toEqual({
      status: 415,
      body: { error: 'Expected a JPEG, PNG or WebP image or an MP4 video' },
    });
    expect(await added()).toEqual([]);
  });

  it('refuses a file over the limit with 413, and leaves no partial file', async () => {
    const { base, added } = await start({ maxBytes: 1000 });
    const response = await upload(base, 'big.jpg', 'image/jpeg', bytes(1001));
    expect(response.status).toBe(413);
    expect(await added()).toEqual([]);
  });

  it('takes a file of exactly the limit', async () => {
    const { base } = await start({ maxBytes: 1000 });
    expect((await upload(base, 'fits.jpg', 'image/jpeg', bytes(1000))).status).toBe(201);
  });

  it('limits files to 200 MB (spec PG-6)', () => {
    expect(MAX_UPLOAD_BYTES).toBe(200 * 1024 * 1024);
  });

  it('answers 400 to a form without a file', async () => {
    const { base } = await start();
    const form = new FormData();
    form.append('name', 'nothing');
    const response = await fetch(`${base}/api/assets`, { method: 'POST', body: form });
    expect(response.status).toBe(400);
  });

  it('gives a name the project can use: a page with the upload as background saves', async () => {
    const { base, store, dir } = await start();
    const { body } = await upload(base, 'New Home.png', 'image/png', bytes(10));
    const [home, ...rest] = store.project.pages;
    const page = { ...home!, background: { type: 'image', asset: body['asset'] } };

    const saved = await fetch(`${base}/api/project`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...store.project, pages: [page, ...rest] }),
    });

    expect(saved.status).toBe(200);
    const onDisk = JSON.parse(await readFile(join(dir, 'project.json'), 'utf8')) as {
      pages: { background: { asset: string } }[];
    };
    expect(onDisk.pages[0]?.background.asset).toBe(body['asset']);
  });
});
