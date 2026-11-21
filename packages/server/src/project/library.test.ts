import { cp, mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateProject } from '@tapcue/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_DIR } from '../config';
import {
  ACTIVE_FILE,
  createLibrary,
  emptyProject,
  folderName,
  type Library,
  TRASH_DIR,
  uniqueId,
} from './library';

let root: string;
let library: Library;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tapcue-library-'));
  library = createLibrary(root);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** A copy of the demo stand in the library, last changed at `time`. */
async function demoCopy(id: string, time = new Date('2026-11-01T10:00:00Z')) {
  await cp(DEFAULT_PROJECT_DIR, join(root, id), { recursive: true });
  await utimes(join(root, id, 'project.json'), time, time);
}

describe('folderName', () => {
  it.each([
    ['WePlay 2026', 'weplay-2026'],
    ['  Café — Main hall!  ', 'cafe-main-hall'],
    ['Zürich Expo', 'zurich-expo'],
    ['Стенд', 'project'],
    ['../../etc', 'etc'],
    ['a'.repeat(50), 'a'.repeat(40)],
  ])('makes "%s" into "%s"', (name, folder) => {
    expect(folderName(name)).toBe(folder);
  });
});

describe('uniqueId', () => {
  it('adds the first free number when the name is taken', () => {
    expect(uniqueId('stand', new Set())).toBe('stand');
    expect(uniqueId('stand', new Set(['stand']))).toBe('stand-2');
    expect(uniqueId('stand', new Set(['stand', 'stand-2']))).toBe('stand-3');
  });
});

describe('emptyProject', () => {
  it('is a valid project with one blank page and one station that starts on it (PRJ-6)', () => {
    const project = emptyProject({ name: 'Hall B', width: 1920, height: 1080 }, 'p_abc123');
    expect(validateProject(project).ok).toBe(true);
    expect(project).toEqual({
      schemaVersion: 1,
      name: 'Hall B',
      canvas: { width: 1920, height: 1080, scaleMode: 'fit', backgroundColor: '#000000' },
      pages: [{ id: 'p_abc123', name: 'Page 1', background: null, hotspots: [] }],
      targets: [],
      stations: [{ id: 'main', name: 'Main', startPageId: 'p_abc123', idleTimeoutSeconds: null }],
    });
  });
});

describe('createLibrary', () => {
  it('creates a project in a folder named after it, with an empty assets/ folder', async () => {
    const id = await library.create({ name: 'Hall B', width: 1920, height: 1080 });

    expect(id).toBe('hall-b');
    expect(await readdir(root)).toEqual(['hall-b']); // no staging folder left behind
    expect(await readdir(join(root, 'hall-b', 'assets'))).toEqual([]);
    const saved = JSON.parse(await readFile(join(root, 'hall-b', 'project.json'), 'utf8')) as {
      name: string;
      pages: { id: string }[];
    };
    expect(saved.name).toBe('Hall B');
    expect(saved.pages[0]?.id).toMatch(/^p_[a-z0-9]{6}$/);
  });

  it('creates the library folder when it does not exist yet', async () => {
    const nested = createLibrary(join(root, 'not', 'yet'));
    expect(await nested.create({ name: 'First', width: 800, height: 600 })).toBe('first');
  });

  it('never reuses a taken folder name, even one that is not a project', async () => {
    await mkdir(join(root, 'hall-b'));
    await writeFile(join(root, 'hall-b-2'), 'a file');
    expect(await library.create({ name: 'Hall B', width: 800, height: 600 })).toBe('hall-b-3');
  });

  it('lists the projects, most recently changed first, and marks the active one (PRJ-5)', async () => {
    await demoCopy('old', new Date('2026-10-01T10:00:00Z'));
    await demoCopy('new', new Date('2026-11-01T10:00:00Z'));

    expect(await library.list(join(root, 'old'))).toEqual([
      {
        id: 'new',
        active: false,
        modified: '2026-11-01T10:00:00.000Z',
        ok: true,
        name: 'Demo stand',
        width: 2048,
        height: 1536,
      },
      {
        id: 'old',
        active: true,
        modified: '2026-10-01T10:00:00.000Z',
        ok: true,
        name: 'Demo stand',
        width: 2048,
        height: 1536,
      },
    ]);
  });

  it('lists a project that does not load with its errors', async () => {
    await mkdir(join(root, 'broken'));
    await writeFile(join(root, 'broken', 'project.json'), '{ not json');

    const [entry] = await library.list(root);

    expect(entry).toMatchObject({ id: 'broken', active: false, ok: false });
    expect(entry?.ok === false && entry.errors[0]?.path).toBe('project.json');
  });

  it('skips hidden folders, folders without project.json and files', async () => {
    await demoCopy('stand');
    await demoCopy('.trash');
    await mkdir(join(root, 'photos'));
    await writeFile(join(root, ACTIVE_FILE), '{}');

    expect((await library.list(root)).map((entry) => entry.id)).toEqual(['stand']);
  });

  it('lists nothing when the library folder does not exist', async () => {
    expect(await createLibrary(join(root, 'missing')).list(root)).toEqual([]);
  });

  it('finds only projects it lists, never a path out of the library', async () => {
    await demoCopy('stand');
    await demoCopy('.trash');
    expect(await library.find('stand')).toBe(join(root, 'stand'));
    for (const id of ['missing', '.trash', '..', '../stand', 'stand/assets', '']) {
      expect(await library.find(id)).toBeNull();
    }
  });

  it('tells the id of a folder in the library, and null for one elsewhere', () => {
    expect(library.idOf(join(root, 'stand'))).toBe('stand');
    expect(library.idOf(join(root, 'stand', 'assets'))).toBeNull();
    expect(library.idOf(DEFAULT_PROJECT_DIR)).toBeNull();
  });

  it('moves a deleted project into .trash/ (PRJ-8)', async () => {
    await demoCopy('stand');
    await library.remove('stand');
    await demoCopy('stand');
    await library.remove('stand');

    expect(await readdir(root)).toEqual([TRASH_DIR]);
    const trashed = await readdir(join(root, TRASH_DIR));
    expect(trashed).toHaveLength(2); // deleted twice under one id: both copies kept
    for (const name of trashed) expect(name).toMatch(/^stand-\d{4}-\d\d-\d\dT/);
  });

  it('refuses to delete a project it does not list', async () => {
    await expect(library.remove('..')).rejects.toThrow(`No project ".." in ${root}`);
  });

  it('remembers the active project for the next start (PRJ-7)', async () => {
    await demoCopy('stand');
    expect(await library.remembered()).toBeNull();

    await library.remember('stand');

    expect(JSON.parse(await readFile(join(root, ACTIVE_FILE), 'utf8'))).toEqual({
      active: 'stand',
    });
    expect(await library.remembered()).toBe(join(root, 'stand'));
  });

  it.each([
    ['a project that is gone', '{ "active": "gone" }'],
    ['a broken file', '{ active'],
    ['no name in it', '{ "active": 3 }'],
    ['a path out of the library', '{ "active": "../stand" }'],
  ])('remembers nothing from %s', async (_, text) => {
    await demoCopy('stand');
    await writeFile(join(root, ACTIVE_FILE), text);
    expect(await library.remembered()).toBeNull();
  });
});
