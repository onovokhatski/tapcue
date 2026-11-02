import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoZip, makeZip } from '../test/zip';
import { importArchive, readArchive } from './projectArchive';

describe('readArchive (spec PRJ-4)', () => {
  it('says what an exported project holds', async () => {
    expect(await readArchive(await demoZip())).toEqual({
      ok: true,
      summary: { name: 'Demo stand', pages: 4, targets: 3, stations: 2 },
    });
  });

  it.each([
    [
      'without project.json',
      [['assets/home.jpg', 'x']],
      'is not a Tapcue project: it has no project.json at its root. Choose a file made with Export .zip.',
    ],
    [
      'with project.json in a folder',
      [['demo-stand/project.json', '{}']],
      'is not a Tapcue project: it has no project.json at its root. Choose a file made with Export .zip.',
    ],
    [
      'with project.json that is not JSON',
      [['project.json', '{ "name": ']],
      'is not a Tapcue project: its project.json is not valid JSON. Choose a file made with Export .zip.',
    ],
    [
      'with project.json that is not a project',
      [['project.json', '{ "name": "Stand", "pages": [] }']],
      'is not a Tapcue project: its project.json is not a project. Choose a file made with Export .zip.',
    ],
  ] as [string, [string, string][], string][])(
    'refuses an archive %s',
    async (_, entries, reason) => {
      expect(await readArchive(await makeZip(entries))).toEqual({ ok: false, reason });
    },
  );

  it('refuses a file that is not a .zip', async () => {
    expect(await readArchive(new Blob(['not a zip at all']))).toEqual({
      ok: false,
      reason: 'is not a .zip file.',
    });
  });
});

describe('importArchive', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function answer(status: number, body: unknown) {
    const fetch = vi.fn(() =>
      Promise.resolve(
        new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  it('sends the file as application/zip and answers the new revision', async () => {
    const fetch = answer(200, { revision: 7 });
    const file = await demoZip();
    expect(await importArchive(file)).toEqual({ ok: true, revision: 7 });
    expect(fetch).toHaveBeenCalledWith('/api/project/import', {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: file,
    });
  });

  it('gives the first error of a refused project, and how many more there are', async () => {
    answer(400, {
      errors: [
        { path: 'pages[0].background.asset', message: 'file "assets/home.jpg" does not exist' },
        { path: 'name', message: 'Expected a name' },
      ],
    });
    expect(await importArchive(new Blob())).toEqual({
      ok: false,
      reason:
        'was refused: pages[0].background.asset: file "assets/home.jpg" does not exist (and 1 more).',
    });
  });

  it('gives the server’s reason for a refused upload, or its status', async () => {
    answer(413, { error: 'Imports are limited to 2048 MB' });
    expect(await importArchive(new Blob())).toEqual({
      ok: false,
      reason: 'was refused: Imports are limited to 2048 MB.',
    });
    // Something between the editor and the server answered instead of it.
    answer(200, '<html>Captive portal</html>');
    expect(await importArchive(new Blob())).toEqual({
      ok: false,
      reason: 'was refused: the server answered 200.',
    });
    answer(502, 'Bad gateway');
    expect(await importArchive(new Blob())).toEqual({
      ok: false,
      reason: 'was refused: the server answered 502.',
    });
  });
});
