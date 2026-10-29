// Loads the project folder (project.json + assets/) and keeps the current project in memory.
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Project, type ValidationError, validateProject } from '@tapcue/shared';

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
}

export async function loadProjectStore(dir: string): Promise<ProjectStore> {
  const project = await loadProject(dir);
  return { dir, project, revision: 1 };
}

/** Reads and checks project.json: valid JSON, a valid project, and every referenced file present. */
export async function loadProject(dir: string): Promise<Project> {
  const file = join(dir, PROJECT_FILE);

  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    throw new ProjectLoadError(dir, [{ path: PROJECT_FILE, message: `cannot read ${file}` }]);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ProjectLoadError(dir, [{ path: PROJECT_FILE, message: `not valid JSON: ${reason}` }]);
  }

  const result = validateProject(json);
  if (!result.ok) throw new ProjectLoadError(dir, result.errors);

  const missing = await missingAssets(dir, result.project);
  if (missing.length) throw new ProjectLoadError(dir, missing);

  return result.project;
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
