// How the click-to-run app starts (ADR 0017): Tapcue.app or Tapcue.exe, started by a click, with no
// repository and no terminal. Its web app and demo stand lie next to the executable; the
// integrator's projects live in Documents/Tapcue; the editor opens in the default browser.
// The app's entry is packaged.ts.
import { execFile } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseConfig } from './config';
import { portInUse, reportStartError, startServer } from './start';

/**
 * Where the web app and the demo stand are: in Contents/Resources inside a macOS app bundle,
 * otherwise in the executable's own folder (the Windows download is a folder with Tapcue.exe).
 */
export function resourcesDir(execPath: string, exists: (path: string) => boolean): string {
  const bundled = join(dirname(execPath), '..', 'Resources');
  return exists(join(bundled, 'web')) ? bundled : dirname(execPath);
}

/** The project the app opens when it is given none: a copy of the demo stand to start from. */
export function defaultProjectDir(home: string): string {
  return join(home, 'Documents', 'Tapcue', 'demo-stand');
}

/**
 * On the first start, copies the demo stand into the default project folder. Only that folder: a
 * project the integrator names is never filled in.
 */
export function prepareDefaultProject(projectDir: string, defaultDir: string, demoDir: string) {
  if (projectDir === defaultDir && !existsSync(join(projectDir, 'project.json'))) {
    cpSync(demoDir, projectDir, { recursive: true });
  }
}

/** How each system opens a URL in the default browser. */
export function browserCommand(platform: NodeJS.Platform, url: string): [string, string[]] {
  if (platform === 'darwin') return ['open', [url]];
  // `start` is built into cmd; its first quoted argument is a window title, hence the "".
  if (platform === 'win32') return ['cmd', ['/c', 'start', '""', url]];
  return ['xdg-open', [url]];
}

function openBrowser(url: string) {
  // TAPCUE_NO_BROWSER: for tests and for a stand computer that starts Tapcue on its own.
  if (process.env['TAPCUE_NO_BROWSER']) return console.log(`Open ${url}`);
  const [command, args] = browserCommand(process.platform, url);
  execFile(command, args, () => undefined);
}

/**
 * Whether Tapcue itself answers on this port: a second click while it already runs. Another
 * program may accept the connection and never answer, hence the time limit.
 */
async function tapcueAnswers(port: number): Promise<boolean> {
  try {
    const health = await fetch(`http://localhost:${port}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return health.ok;
  } catch {
    return false;
  }
}

export async function launch() {
  const resources = process.env['TAPCUE_RESOURCES'] ?? resourcesDir(process.execPath, existsSync);
  const defaultDir = defaultProjectDir(homedir());
  const config = parseConfig(process.argv.slice(2), process.env, process.cwd(), defaultDir);
  const editor = `http://localhost:${config.port}/edit`;
  try {
    prepareDefaultProject(config.projectDir, defaultDir, join(resources, 'demo-stand'));
    await startServer(config, join(resources, 'web'), { quittable: true });
    openBrowser(editor);
  } catch (error) {
    const port = portInUse(error);
    if (port !== null && (await tapcueAnswers(port))) {
      console.log(`Tapcue is already running on port ${port}.`);
      openBrowser(editor);
      process.exit(0);
    }
    if (!reportStartError(error)) throw error;
    process.exit(1);
  }
}
