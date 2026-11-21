// The project library (ADR 0021): a folder whose subfolders are projects. It lists them, creates
// empty ones, moves deleted ones into .trash/ and remembers which one is active in tapcue.json.
// Which project runs, and switching to another, is the store's job (store.ts).
import { randomInt } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import {
  type NewProject,
  type Project,
  type ProjectEntry,
  SCHEMA_VERSION,
  validateProject,
} from '@tapcue/shared';
import { checkProjectDir, PROJECT_FILE } from './store';

/** Names the active project, so it is opened again after a restart. */
export const ACTIVE_FILE = 'tapcue.json';
/** Deleted projects go here, so a mistake can be undone by hand (spec PRJ-8). */
export const TRASH_DIR = '.trash';

export interface Library {
  readonly dir: string;
  /** Every project folder, most recently changed first; `activeDir` is marked active. */
  list(activeDir: string): Promise<ProjectEntry[]>;
  /** The library's id of a project folder, or null when the folder is not in the library. */
  idOf(projectDir: string): string | null;
  /** The folder of a project in the library, or null when there is none with that id. */
  find(id: string): Promise<string | null>;
  /** Creates an empty project in a new folder named after it; returns the folder's id. */
  create(input: NewProject): Promise<string>;
  /** Moves a project's folder into .trash/. */
  remove(id: string): Promise<void>;
  /** The folder of the project last opened, or null when none is remembered or it is gone. */
  remembered(): Promise<string | null>;
  remember(id: string): Promise<void>;
}

export function createLibrary(dir: string): Library {
  const root = resolve(dir);

  /** Folders holding a project.json. Hidden ones (.trash, an import in progress) are not projects. */
  async function projectIds(): Promise<string[]> {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      return []; // no library folder yet: no projects
    }
    const ids = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);
    const withProject = await Promise.all(ids.map((id) => exists(join(root, id, PROJECT_FILE))));
    return ids.filter((_, i) => withProject[i]);
  }

  async function find(id: string): Promise<string | null> {
    // Only a name the library lists: never a path that could reach outside it.
    return (await projectIds()).includes(id) ? join(root, id) : null;
  }

  return {
    dir: root,

    async list(activeDir) {
      const active = resolve(activeDir);
      const entries = await Promise.all(
        (await projectIds()).map(async (id): Promise<ProjectEntry> => {
          const folder = join(root, id);
          const { mtime } = await stat(join(folder, PROJECT_FILE));
          const base = { id, active: folder === active, modified: mtime.toISOString() };
          const result = await checkProjectDir(folder);
          if (!result.ok) return { ...base, ok: false, errors: result.errors };
          const { name, canvas } = result.project;
          return { ...base, ok: true, name, width: canvas.width, height: canvas.height };
        }),
      );
      return entries.sort(
        (a, b) => b.modified.localeCompare(a.modified) || a.id.localeCompare(b.id),
      );
    },

    idOf(projectDir) {
      const folder = resolve(projectDir);
      return dirname(folder) === root ? basename(folder) : null;
    },

    find,

    async create(input) {
      await mkdir(root, { recursive: true });
      const taken = new Set(await readdir(root));
      const id = uniqueId(folderName(input.name), taken);
      // Prepared in a hidden folder, then renamed: the library never shows half a project.
      const staging = join(root, `.new-${id}`);
      await rm(staging, { recursive: true, force: true });
      try {
        await mkdir(join(staging, 'assets'), { recursive: true });
        const project = emptyProject(input, randomPageId());
        await writeFile(join(staging, PROJECT_FILE), `${JSON.stringify(project, null, 2)}\n`);
        await rename(staging, join(root, id));
      } catch (error) {
        await rm(staging, { recursive: true, force: true });
        throw error;
      }
      return id;
    },

    async remove(id) {
      const folder = await find(id);
      if (folder === null) throw new Error(`No project "${id}" in ${root}`);
      await mkdir(join(root, TRASH_DIR), { recursive: true });
      // A time in the name: a project deleted twice under the same id keeps both copies.
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await rename(folder, join(root, TRASH_DIR, `${id}-${stamp}`));
    },

    async remembered() {
      try {
        const saved = JSON.parse(await readFile(join(root, ACTIVE_FILE), 'utf8')) as unknown;
        const id = (saved as { active?: unknown } | null)?.active;
        return typeof id === 'string' ? await find(id) : null;
      } catch {
        return null; // none yet, or not readable: start as if nothing was opened
      }
    },

    async remember(id) {
      await mkdir(root, { recursive: true });
      await writeFile(join(root, ACTIVE_FILE), `${JSON.stringify({ active: id }, null, 2)}\n`);
    },
  };
}

/** A folder name from a project name: lowercase letters, digits and "-", at most 40 characters. */
export function folderName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // accents: é → e
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
  return slug || 'project';
}

/** `id`, or `id-2`, `id-3`… when the name is taken. */
export function uniqueId(id: string, taken: ReadonlySet<string>): string {
  if (!taken.has(id)) return id;
  let n = 2;
  while (taken.has(`${id}-${n}`)) n += 1;
  return `${id}-${n}`;
}

/** One blank page and one station, "main", that starts on it (spec PRJ-6). */
export function emptyProject({ name, width, height }: NewProject, pageId: string): Project {
  const project = {
    schemaVersion: SCHEMA_VERSION,
    name,
    canvas: { width, height, scaleMode: 'fit', backgroundColor: '#000000' },
    pages: [{ id: pageId, name: 'Page 1', background: null, hotspots: [] }],
    targets: [],
    stations: [{ id: 'main', name: 'Main', startPageId: pageId, idleTimeoutSeconds: null }],
  };
  // Checked like any save, so a change to the format cannot make new projects unloadable.
  const result = validateProject(project);
  if (!result.ok) throw new Error(`An empty project is invalid: ${JSON.stringify(result.errors)}`);
  return result.project;
}

/** A page id like the editor makes: "p_" and six lowercase letters or digits. */
function randomPageId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return `p_${Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('')}`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
