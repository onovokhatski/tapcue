// Loads the project folder (project.json + assets/), keeps the current project in memory and
// saves the editor's changes back to disk, or replaces the whole folder with an imported one.
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

export interface ProjectStore {
  readonly dir: string;
  readonly project: Project;
  /** Increases with every save, so clients can tell that their copy is stale (architecture §6). */
  readonly revision: number;
  /** Checks a whole project and, if it is valid, writes it to disk and makes it current. */
  save(input: unknown): Promise<ValidationResult & { revision: number }>;
  /**
   * Replaces the whole project — project.json and assets/ — with a folder prepared elsewhere (an
   * import), checked like a load. The previous assets/ is moved into `source` for the caller to
   * delete.
   */
  replace(source: string): Promise<ValidationResult & { revision: number }>;
}

export async function loadProjectStore(dir: string): Promise<ProjectStore> {
  let project = await loadProject(dir);
  let revision = 1;
  let queue: Promise<unknown> = Promise.resolve();

  async function save(input: unknown) {
    const result = await checkProject(dir, input);
    if (!result.ok) return { ...result, revision };
    await writeAtomically(join(dir, PROJECT_FILE), `${JSON.stringify(result.project, null, 2)}\n`);
    project = result.project;
    revision += 1;
    return { ...result, revision };
  }

  async function replace(source: string) {
    const read = await readProjectJson(source);
    const result = read.ok ? await checkProject(source, read.json) : read;
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

  /** Saves and replacements run one after another, so the disk always matches memory. */
  function queued<T>(work: () => Promise<T>): Promise<T> {
    const done = queue.then(work);
    queue = done.catch(() => undefined);
    return done;
  }

  return {
    dir,
    get project() {
      return project;
    },
    get revision() {
      return revision;
    },
    save: (input) => queued(() => save(input)),
    replace: (source) => queued(() => replace(source)),
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
  const read = await readProjectJson(dir);
  const result = read.ok ? await checkProject(dir, read.json) : read;
  if (!result.ok) throw new ProjectLoadError(dir, result.errors);
  return result.project;
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
  const checks = project.pages.map(async (page, p) => {
    if (!page.background) return null;
    const { asset } = page.background;
    try {
      await access(join(dir, asset));
      return null;
    } catch {
      return { path: `pages[${p}].background.asset`, message: `file "${asset}" does not exist` };
    }
  });
  return (await Promise.all(checks)).filter((error) => error !== null);
}
