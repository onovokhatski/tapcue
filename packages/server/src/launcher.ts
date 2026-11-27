// How the click-to-run app starts (ADR 0017): Tapcue.app or Tapcue.exe, started by a click, with no
// repository and no terminal. Its web app and demo stand lie next to the executable; the
// integrator's projects live in Documents/Tapcue, with the app's log; the editor opens in the
// default browser, and a start that fails opens a page that says why (issue #230).
// The app's entry is packaged.ts.
import { execFile } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type AppLog, openAppLog, routeConsole, writeErrorPage } from './appLog';
import { defaultProjectsDir, parseConfig } from './config';
import { portInUse, startErrorMessage, startServer } from './start';

/**
 * Where the web app and the demo stand are: in Contents/Resources inside a macOS app bundle,
 * otherwise in the executable's own folder (the Windows download is a folder with Tapcue.exe).
 */
export function resourcesDir(execPath: string, exists: (path: string) => boolean): string {
  const bundled = join(dirname(execPath), '..', 'Resources');
  return exists(join(bundled, 'web')) ? bundled : dirname(execPath);
}

/**
 * The project the app opens when it is given none and has opened none from the library: a copy of
 * the demo stand to start from, inside the library.
 */
export function defaultProjectDir(home: string): string {
  return join(defaultProjectsDir(home), 'demo-stand');
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
  // windowsHide: `cmd` would flash a console window of its own for a windowed Tapcue.exe.
  execFile(command, args, { windowsHide: true }, () => undefined);
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

/**
 * The app's log, in Documents/Tapcue next to the projects, or in the system's temporary folder
 * when that cannot be written. Everything the console would print goes there.
 */
function startLog(): AppLog | null {
  const log = openAppLog(defaultProjectsDir(homedir())) ?? openAppLog(tmpdir());
  if (log) routeConsole(log);
  console.log(`\n--- Tapcue started ${new Date().toISOString()} ---`);
  return log;
}

/** With no terminal to print to, a start that fails opens a page in the browser that says why. */
function showStartError(message: string, log: AppLog | null) {
  const page =
    writeErrorPage(log ? dirname(log.path) : tmpdir(), message, log?.path ?? null) ??
    writeErrorPage(tmpdir(), message, log?.path ?? null);
  if (page) openBrowser(page);
}

export async function launch() {
  const log = startLog();
  const resources = process.env['TAPCUE_RESOURCES'] ?? resourcesDir(process.execPath, existsSync);
  const defaultDir = defaultProjectDir(homedir());
  let editor: string | null = null;
  try {
    const config = parseConfig(process.argv.slice(2), process.env, process.cwd(), {
      defaultProjectDir: defaultDir,
    });
    editor = `http://localhost:${config.port}/edit`;
    prepareDefaultProject(config.projectDir, defaultDir, join(resources, 'demo-stand'));
    await startServer(config, join(resources, 'web'), {
      quittable: true,
      ...(log ? { log } : {}),
    });
    openBrowser(editor);
  } catch (error) {
    const port = portInUse(error);
    if (editor && port !== null && (await tapcueAnswers(port))) {
      // A second click while it already runs: show the editor again.
      console.log(`Tapcue is already running on port ${port}.`);
      openBrowser(editor);
      process.exit(0);
    }
    const message =
      startErrorMessage(error) ??
      `Tapcue stopped on an unexpected error: ${error instanceof Error ? error.message : String(error)}`;
    console.error(message);
    if (error instanceof Error && startErrorMessage(error) === null) console.error(error.stack);
    showStartError(message, log);
    process.exit(1);
  }
}
