// The click-to-run app's bundle, run as the app runs it: one file, its web app and demo stand next
// to it, a home folder of its own, no repository around it (ADR 0017).
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_DIR } from './config';

const SERVER = resolve(import.meta.dirname, '..');
const PORT = 4950;
let root: string;
let env: NodeJS.ProcessEnv;

beforeAll(() => {
  execFileSync('npm', ['run', 'build:app'], { cwd: SERVER, stdio: 'ignore' });
  root = mkdtempSync(join(tmpdir(), 'tapcue-bundle-'));
  const resources = join(root, 'Tapcue');
  mkdirSync(join(resources, 'web'), { recursive: true });
  writeFileSync(join(resources, 'web', 'index.html'), '<div id="root"></div>');
  cpSync(DEFAULT_PROJECT_DIR, join(resources, 'demo-stand'), { recursive: true });
  cpSync(join(SERVER, 'dist', 'tapcue.cjs'), join(resources, 'tapcue.cjs'));
  mkdirSync(join(root, 'home'));
  const home = join(root, 'home');
  env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    TAPCUE_RESOURCES: resources,
    TAPCUE_NO_BROWSER: '1',
  };
}, 60_000);

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Runs the bundle with node; `done` resolves with its exit code and output once it exits. */
function runApp() {
  const child = spawn(
    process.execPath,
    [join(root, 'Tapcue', 'tapcue.cjs'), '--port', String(PORT)],
    {
      cwd: root,
      env,
    },
  );
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const done = new Promise<{ code: number | null; output: string }>((resolveExit) =>
    child.on('exit', (code) => resolveExit({ code, output })),
  );
  return { child, done, output: () => output };
}

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('The app did not start');
}

describe('the click-to-run app’s bundle (ADR 0017)', () => {
  it('serves the editor with the demo stand copied into Documents/Tapcue, and a second click opens it again', async () => {
    const app = runApp();
    try {
      await waitForHealth();
      const editor = await fetch(`http://localhost:${PORT}/edit/pages`);
      expect(await editor.text()).toBe('<div id="root"></div>');
      const { project } = (await (await fetch(`http://localhost:${PORT}/api/project`)).json()) as {
        project: { name: string };
      };
      expect(project.name).toBe('Demo stand');
      expect(
        existsSync(join(root, 'home', 'Documents', 'Tapcue', 'demo-stand', 'project.json')),
      ).toBe(true);
      expect(app.output()).toContain(`Open http://localhost:${PORT}/edit`);

      const second = await runApp().done;
      expect(second.code).toBe(0);
      expect(second.output).toContain(`Tapcue is already running on port ${PORT}.`);

      // Quit from the editor stops the app itself.
      expect((await fetch(`http://localhost:${PORT}/api/quit`, { method: 'POST' })).status).toBe(
        202,
      );
      expect((await app.done).code).toBe(0);
    } finally {
      app.child.kill();
      await app.done;
    }
  }, 60_000);

  it('says so and stops when another program holds the port', async () => {
    const other = createServer().listen(PORT);
    await new Promise((r) => other.once('listening', r));
    try {
      const { code, output } = await runApp().done;
      expect(code).toBe(1);
      expect(output).toContain(`Tapcue cannot start: port ${PORT} is in use by another program.`);
    } finally {
      other.close();
    }
  }, 60_000);
});
