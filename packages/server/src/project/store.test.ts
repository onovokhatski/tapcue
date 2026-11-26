import { chmod, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_DIR } from '../config';
import { asVersion1, singleCommands } from '../test/version1';
import { loadProject, loadProjectStore, PROJECT_FILE, ProjectLoadError } from './store';

// Each test works on its own copy of the demo stand in a temporary folder.
const dirs: string[] = [];
async function demoCopy(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'tapcue-store-'));
  dirs.push(dir);
  await cp(DEFAULT_PROJECT_DIR, dir, { recursive: true });
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function editProject(dir: string, change: (project: Record<string, unknown>) => void) {
  const file = join(dir, 'project.json');
  const project = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  change(project);
  await writeFile(file, JSON.stringify(project));
}

/** The errors of a failed load, or a failing assertion if it loaded. */
async function loadErrors(dir: string) {
  try {
    await loadProject(dir);
  } catch (error) {
    if (error instanceof ProjectLoadError) return error.errors;
    throw error;
  }
  throw new Error('expected the project to fail loading');
}

describe('loadProjectStore', () => {
  it('loads the demo stand at revision 1', async () => {
    const store = await loadProjectStore(DEFAULT_PROJECT_DIR);
    expect(store.revision).toBe(1);
    expect(store.project.name).toBe('Demo stand');
    expect(store.dir).toBe(DEFAULT_PROJECT_DIR);
  });
});

describe('loadProject', () => {
  it('reports a folder without project.json', async () => {
    const dir = await demoCopy();
    await rm(join(dir, 'project.json'));
    expect(await loadErrors(dir)).toEqual([
      { path: 'project.json', message: `cannot read ${join(dir, 'project.json')}` },
    ]);
  });

  it('reports a file that is not JSON', async () => {
    const dir = await demoCopy();
    await writeFile(join(dir, 'project.json'), '{ "schemaVersion": 1, ');
    const [error] = await loadErrors(dir);
    expect(error?.path).toBe('project.json');
    expect(error?.message).toMatch(/^not valid JSON: /);
  });

  it('reports validation errors with their paths', async () => {
    const dir = await demoCopy();
    await editProject(dir, (project) => (project['name'] = ''));
    expect(await loadErrors(dir)).toEqual([{ path: 'name', message: 'Expected a name' }]);
  });

  it('reports a background file that is missing from the folder', async () => {
    const dir = await demoCopy();
    await rm(join(dir, 'assets', 'about-loop.mp4'));
    expect(await loadErrors(dir)).toEqual([
      { path: 'pages[3].background.asset', message: 'file "assets/about-loop.mp4" does not exist' },
    ]);
  });

  it('counts the problems in its message', async () => {
    const dir = await demoCopy();
    await rm(join(dir, 'assets', 'home.jpg'));
    await rm(join(dir, 'assets', 'about-loop.mp4'));
    await expect(loadProject(dir)).rejects.toThrow(`The project in ${dir} has 2 problems`);
  });
});

describe('save', () => {
  const readSaved = async (dir: string) =>
    JSON.parse(await readFile(join(dir, PROJECT_FILE), 'utf8')) as unknown;

  it('writes a valid project to disk, makes it current and moves to the next revision', async () => {
    const dir = await demoCopy();
    const store = await loadProjectStore(dir);
    const changed = { ...store.project, name: 'Renamed stand' };

    const result = await store.save(changed);

    expect(result).toEqual({ ok: true, project: changed, revision: 2 });
    expect(store.revision).toBe(2);
    expect(store.project).toEqual(changed);
    expect(await readSaved(dir)).toEqual(changed);
    expect((await loadProject(dir)).name).toBe('Renamed stand');
  });

  it('writes readable JSON: two-space indent and a final newline', async () => {
    const dir = await demoCopy();
    const store = await loadProjectStore(dir);
    await store.save(store.project);
    const text = await readFile(join(dir, PROJECT_FILE), 'utf8');
    expect(text).toBe(`${JSON.stringify(store.project, null, 2)}\n`);
  });

  it('refuses an invalid project with its errors, and changes nothing', async () => {
    const dir = await demoCopy();
    const store = await loadProjectStore(dir);
    const before = await readFile(join(dir, PROJECT_FILE), 'utf8');

    const result = await store.save({ ...store.project, name: '' });

    expect(result).toEqual({
      ok: false,
      errors: [{ path: 'name', message: 'Expected a name' }],
      revision: 1,
    });
    expect(store.revision).toBe(1);
    expect(store.project.name).toBe('Demo stand');
    expect(await readFile(join(dir, PROJECT_FILE), 'utf8')).toBe(before);
  });

  it('refuses a project whose background file is not in the folder', async () => {
    const dir = await demoCopy();
    const store = await loadProjectStore(dir);
    const [home, ...rest] = store.project.pages;
    if (!home) throw new Error('the demo stand has pages');
    const page = { ...home, background: { type: 'image', asset: 'assets/nothing.jpg' } };

    const result = await store.save({ ...store.project, pages: [page, ...rest] });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual([
      { path: 'pages[0].background.asset', message: 'file "assets/nothing.jpg" does not exist' },
    ]);
    expect(store.revision).toBe(1);
  });

  describe('mini-site backgrounds (project format §9.4)', () => {
    async function saveSite(withIndex: boolean) {
      const dir = await demoCopy();
      await mkdir(join(dir, 'assets/sites/catalog/img'), { recursive: true });
      await writeFile(join(dir, 'assets/sites/catalog/img/a.png'), '');
      if (withIndex) await writeFile(join(dir, 'assets/sites/catalog/index.html'), '<h1>Hi</h1>');
      const store = await loadProjectStore(dir);
      const [home, ...rest] = store.project.pages;
      if (!home) throw new Error('the demo stand has pages');
      const page = { ...home, background: { type: 'web', site: 'assets/sites/catalog' } };
      return store.save({ ...store.project, pages: [page, ...rest] });
    }

    it('saves a mini-site that has its index.html', async () => {
      expect((await saveSite(true)).ok).toBe(true);
    });

    it('refuses a mini-site without an index.html', async () => {
      const result = await saveSite(false);
      expect(result.ok ? [] : result.errors).toEqual([
        {
          path: 'pages[0].background.site',
          message: 'file "assets/sites/catalog/index.html" does not exist',
        },
      ]);
    });

    it('checks no file for an online address', async () => {
      const dir = await demoCopy();
      const store = await loadProjectStore(dir);
      const [home, ...rest] = store.project.pages;
      if (!home) throw new Error('the demo stand has pages');
      const page = { ...home, background: { type: 'web', url: 'https://example.com' } };
      expect((await store.save({ ...store.project, pages: [page, ...rest] })).ok).toBe(true);
    });
  });

  it('refuses a project whose hotspot image is not in the folder (spec HS-9)', async () => {
    const dir = await demoCopy();
    const store = await loadProjectStore(dir);
    const [home, ...rest] = store.project.pages;
    if (!home) throw new Error('the demo stand has pages');
    const [first, ...others] = home.hotspots;
    if (!first) throw new Error('the home page has hotspots');
    const withImage = { ...first, style: { ...first.style, image: 'assets/card.png' } };
    const page = { ...home, hotspots: [withImage, ...others] };

    const result = await store.save({ ...store.project, pages: [page, ...rest] });

    expect(result.ok ? [] : result.errors).toEqual([
      {
        path: 'pages[0].hotspots[0].style.image',
        message: 'file "assets/card.png" does not exist',
      },
    ]);
  });

  it('saves a hotspot image that is in the folder', async () => {
    const dir = await demoCopy();
    const store = await loadProjectStore(dir);
    const [home, ...rest] = store.project.pages;
    if (!home) throw new Error('the demo stand has pages');
    const [first, ...others] = home.hotspots;
    if (!first) throw new Error('the home page has hotspots');
    const withImage = { ...first, style: { ...first.style, image: 'assets/home.jpg' } };

    const result = await store.save({
      ...store.project,
      pages: [{ ...home, hotspots: [withImage, ...others] }, ...rest],
    });

    expect(result.ok).toBe(true);
  });

  it('leaves no temporary file behind', async () => {
    const dir = await demoCopy();
    const store = await loadProjectStore(dir);
    const before = await readdir(dir);
    await store.save(store.project);
    expect(await readdir(dir)).toEqual(before);
  });

  it('keeps the old project when the new one cannot be written', async () => {
    const dir = await demoCopy();
    const store = await loadProjectStore(dir);
    const before = await readFile(join(dir, PROJECT_FILE), 'utf8');
    // project.json itself stays writable, but no new file can be created next to it.
    await chmod(dir, 0o555);
    try {
      await expect(store.save({ ...store.project, name: 'Renamed stand' })).rejects.toThrow();
    } finally {
      await chmod(dir, 0o755);
    }
    expect(await readFile(join(dir, PROJECT_FILE), 'utf8')).toBe(before);
    expect(store.project.name).toBe('Demo stand');
    expect(store.revision).toBe(1);
  });

  it('runs saves one after another: the last one sent is on disk and in memory', async () => {
    const dir = await demoCopy();
    const store = await loadProjectStore(dir);
    const names = ['One', 'Two', 'Three'];

    const results = await Promise.all(names.map((name) => store.save({ ...store.project, name })));

    expect(results.map((result) => result.revision)).toEqual([2, 3, 4]);
    expect(store.project.name).toBe('Three');
    expect(await readSaved(dir)).toMatchObject({ name: 'Three' });
  });
});

describe('open (ADR 0021)', () => {
  it('makes another folder the active project at the next revision', async () => {
    const first = await demoCopy();
    const second = await demoCopy();
    await editProject(second, (project) => {
      project['name'] = 'Hall B';
    });
    const store = await loadProjectStore(first);

    const result = await store.open(second);

    expect(result).toMatchObject({ ok: true, revision: 2 });
    expect(store.dir).toBe(second);
    expect(store.project.name).toBe('Hall B');
    expect(store.revision).toBe(2);
    expect(store.openedAt).toBe(2);
  });

  it('refuses a folder that does not load, and keeps the project that is open', async () => {
    const first = await demoCopy();
    const broken = await demoCopy();
    await writeFile(join(broken, PROJECT_FILE), '{ not json');
    const store = await loadProjectStore(first);

    const result = await store.open(broken);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]?.path).toBe(PROJECT_FILE);
    expect(store.dir).toBe(first);
    expect(store.revision).toBe(1);
    expect(store.openedAt).toBe(1);
  });

  it('saves into the folder that is open now', async () => {
    const first = await demoCopy();
    const second = await demoCopy();
    const store = await loadProjectStore(first);
    await store.open(second);

    await store.save({ ...store.project, name: 'Saved after the switch' });

    const saved = JSON.parse(await readFile(join(second, PROJECT_FILE), 'utf8')) as {
      name: string;
    };
    expect(saved.name).toBe('Saved after the switch');
    const untouched = JSON.parse(await readFile(join(first, PROJECT_FILE), 'utf8')) as {
      name: string;
    };
    expect(untouched.name).toBe('Demo stand');
  });

  it('refuses a save based on a copy of the project open before, and writes nothing', async () => {
    const first = await demoCopy();
    const second = await demoCopy();
    const store = await loadProjectStore(first);
    const before = await readFile(join(second, PROJECT_FILE), 'utf8');
    await store.open(second); // revision 2

    const stale = await store.save({ ...store.project, name: 'From the old editor' }, 1);

    expect(stale).toEqual({ ok: false, errors: [], revision: 2, stale: true });
    expect(await readFile(join(second, PROJECT_FILE), 'utf8')).toBe(before);
    expect(store.revision).toBe(2);
  });

  it('takes a save based on the open project, or one that names no revision', async () => {
    const store = await loadProjectStore(await demoCopy());
    await store.open(await demoCopy()); // revision 2

    expect(await store.save({ ...store.project, name: 'A' }, 2)).toMatchObject({ ok: true });
    expect(await store.save({ ...store.project, name: 'B' }, 3)).toMatchObject({ ok: true });
    expect(await store.save({ ...store.project, name: 'C' })).toMatchObject({ revision: 5 });
  });
});

describe('a project from Tapcue 0.4 or older (schema version 1, ADR 0022)', () => {
  it('loads it upgraded, and writes version 2 only on the next save', async () => {
    const dir = await demoCopy();
    const file = join(dir, PROJECT_FILE);
    // Version 1 has no sequences: the demo stand's Play demo keeps its first command.
    const current = singleCommands(JSON.parse(await readFile(file, 'utf8')) as unknown);
    await writeFile(file, JSON.stringify(asVersion1(current)));

    const store = await loadProjectStore(dir);

    expect(store.project).toEqual(current);
    expect(
      (JSON.parse(await readFile(file, 'utf8')) as { schemaVersion: number }).schemaVersion,
    ).toBe(1);
    await store.save(store.project);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(current);
  });
});
