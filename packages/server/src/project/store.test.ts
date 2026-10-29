import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_DIR } from '../config';
import { loadProject, loadProjectStore, ProjectLoadError } from './store';

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
