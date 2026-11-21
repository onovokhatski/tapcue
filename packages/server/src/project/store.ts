// Loads the project folder (project.json + assets/), keeps the current project in memory and
// saves the editor's changes back to disk, replaces the whole folder with an imported one, or
// switches to another project folder from the library (ADR 0021).
import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type Project,
  type ValidationError,
  type ValidationResult,
  validateProject,
} from '@tapcue/shared';

export const PROJECT_FILE = 'project.json';

/** The project could not be loaded; `errors` say where and why. */
export class ProjectLoadError extends Error {
  constructor(
    readonly dir: string,
    readonly errors: ValidationError[],
  ) {
    super(`The project in ${dir} has ${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  }
}

/** A save's outcome; `stale` when it was based on a project that is no longer open. */
export type SaveResult = ValidationResult & { revision: number; stale?: true };

export interface ProjectStore {
  /** The active project's folder; it changes when another project is opened. */
  readonly dir: string;
  readonly project: Project;
  /** Increases with every save, so clients can tell that their copy is stale (architecture §6). */
  readonly revision: number;
  /** The revision at which the active project was opened: older copies belong to another one. */
  readonly openedAt: number;
  /**
   * Checks a whole project and, if it is valid, writes it to disk and makes it current. `basedOn`
   * is the revision the client's copy came from: a copy older than `openedAt` was made of the
   * project that was open before, and is refused as stale rather than written into this one.
   */
  save(input: unknown, basedOn?: number): Promise<SaveResult>;
  /**
   * Replaces the whole project — project.json and assets/ — with a folder prepared elsewhere (an
   * import), checked like a load. The previous assets/ is moved into `source` for the caller to
   * delete.
   */
  replace(source: string): Promise<ValidationResult & { revision: number }>;
  /** Makes another project folder the active one, checked like a load (spec PRJ-7). */
  open(dir: string): Promise<ValidationResult & { revision: number }>;
}

export async function loadProjectStore(startDir: string): Promise<ProjectStore> {
  let dir = startDir;
  let project = await loadProject(dir);
  let revision = 1;
  let openedAt = revision;
  let queue: Promise<unknown> = Promise.resolve();

  async function save(input: unknown, basedOn?: number): Promise<SaveResult> {
    if (basedOn !== undefined && basedOn < openedAt) {
      return { ok: false, errors: [], revision, stale: true };
    }
    const result = await checkProject(dir, input);
    if (!result.ok) return { ...result, revision };
    await writeAtomically(join(dir, PROJECT_FILE), `${JSON.stringify(result.project, null, 2)}\n`);
    project = result.project;
    revision += 1;
    return { ...result, revision };
  }

  async function replace(source: string) {
    const result = await checkProjectDir(source);
    if (!result.ok) return { ...result, revision };
    const assets = join(dir, 'assets');
    const previous = join(source, 'previous-assets');
    // Two renames swap assets/; project.json follows as in a save. If that write fails, the old
    // assets/ goes back, so project.json and assets/ always belong together.
    await renameIfExists(assets, previous);
    await rename(join(source, 'assets'), assets);
    try {
      await writeAtomically(
        join(dir, PROJECT_FILE),
        `${JSON.stringify(result.project, null, 2)}\n`,
      );
    } catch (error) {
      await rename(assets, join(source, 'assets'));
      await renameIfExists(previous, assets);
      throw error;
    }
    project = result.project;
    revision += 1;
    return { ...result, revision };
  }

  async function open(next: string) {
    const result = await checkProjectDir(next);
    if (!result.ok) return { ...result, revision };
    dir = next;
    project = result.project;
    revision += 1;
    openedAt = revision;
    return { ...result, revision };
  }

  /** Saves, replacements and switches run one after another, so the disk always matches memory. */
  function queued<T>(work: () => Promise<T>): Promise<T> {
    const done = queue.then(work);
    queue = done.catch(() => undefined);
    return done;
  }

  return {
    get dir() {
      return dir;
    },
    get project() {
      return project;
    },
    get revision() {
      return revision;
    },
    get openedAt() {
      return openedAt;
    },
    save: (input, basedOn) => queued(() => save(input, basedOn)),
    replace: (source) => queued(() => replace(source)),
    open: (next) => queued(() => open(next)),
  };
}

async function renameIfExists(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

/**
 * Writes a temporary file next to the target, then renames it over the target: a rename is atomic,
 * so a crash mid-write leaves the old file intact, never half a project (architecture §6).
 */
async function writeAtomically(file: string, text: string): Promise<void> {
  const temporary = `${file}.tmp`;
  try {
    await writeFile(temporary, text, 'utf8');
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

/** Reads and checks project.json: valid JSON, a valid project, and every referenced file present. */
export async function loadProject(dir: string): Promise<Project> {
  const result = await checkProjectDir(dir);
  if (!result.ok) throw new ProjectLoadError(dir, result.errors);
  return result.project;
}

/** The checks of a load, as a result instead of an error: for listing and opening projects. */
export async function checkProjectDir(dir: string): Promise<ValidationResult> {
  const read = await readProjectJson(dir);
  return read.ok ? checkProject(dir, read.json) : read;
}

async function readProjectJson(
  dir: string,
): Promise<{ ok: true; json: unknown } | { ok: false; errors: ValidationError[] }> {
  const file = join(dir, PROJECT_FILE);
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return { ok: false, errors: [{ path: PROJECT_FILE, message: `cannot read ${file}` }] };
  }
  try {
    return { ok: true, json: JSON.parse(text) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [{ path: PROJECT_FILE, message: `not valid JSON: ${reason}` }] };
  }
}

/** The schema and references, then the files on disk — the same checks for loading and saving. */
async function checkProject(dir: string, input: unknown): Promise<ValidationResult> {
  const result = validateProject(input);
  if (!result.ok) return result;
  const missing = await missingAssets(dir, result.project);
  return missing.length ? { ok: false, errors: missing } : result;
}

/** The schema cannot see the disk, so the server checks the files (project format §10). */
async function missingAssets(dir: string, project: Project): Promise<ValidationError[]> {
  // Every file the project names: page backgrounds and hotspot images (spec HS-9).
  const named = project.pages.flatMap((page, p) => [
    ...(page.background
      ? [{ path: `pages[${p}].background.asset`, asset: page.background.asset }]
      : []),
    ...page.hotspots.flatMap((hotspot, h) =>
      hotspot.style.image
        ? [{ path: `pages[${p}].hotspots[${h}].style.image`, asset: hotspot.style.image }]
        : [],
    ),
  ]);
  const checks = named.map(async ({ path, asset }) => {
    try {
      await access(join(dir, asset));
      return null;
    } catch {
      return { path, message: `file "${asset}" does not exist` };
    }
  });
  return (await Promise.all(checks)).filter((error) => error !== null);
}
