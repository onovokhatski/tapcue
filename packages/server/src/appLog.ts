// The click-to-run app's log and start-error page (issue #230). The app runs without a terminal on
// both systems (a windowed Tapcue.exe, LSUIElement on macOS), so what `npm start` prints goes to a
// file in Documents/Tapcue instead, and a start that fails says why on a page in the browser.
import {
  closeSync,
  mkdirSync,
  openSync,
  renameSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';
import { format } from 'node:util';

export const LOG_FILE = 'tapcue.log';
/** A log that grew past this is kept once as tapcue.old.log, and a new one starts. */
export const MAX_LOG_BYTES = 1_000_000;

/** Somewhere to write lines: the server's logger and the console both use it. */
export interface AppLog {
  path: string;
  write(text: string): void;
}

/**
 * Opens the log in `dir` for appending: a second click on a running app adds to it rather than
 * wiping what the first one wrote. Writes are synchronous, so the last lines reach the file even
 * when the app exits right after them. Null when the folder cannot be written.
 */
export function openAppLog(dir: string): AppLog | null {
  try {
    mkdirSync(dir, { recursive: true });
    const path = join(dir, LOG_FILE);
    if (sizeOf(path) > MAX_LOG_BYTES) renameSync(path, join(dir, 'tapcue.old.log'));
    const fd = openSync(path, 'a');
    process.once('exit', () => closeSync(fd));
    return { path, write: (text) => void writeSync(fd, text) };
  } catch {
    return null;
  }
}

function sizeOf(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0; // no log yet
  }
}

/** Sends console.log, info, warn and error to the log, as lines. */
export function routeConsole(log: AppLog, target: Console = console): void {
  const line = (...args: unknown[]) => log.write(`${format(...args)}\n`);
  target.log = line;
  target.info = line;
  target.warn = line;
  target.error = line;
}

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A page that says why Tapcue did not start and where its log is, for the browser. */
export function errorPage(message: string, logPath: string | null): string {
  const log = logPath
    ? `<p>The log is in <code>${escape(logPath)}</code>.</p>`
    : '<p>No log could be written.</p>';
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Tapcue did not start</title>
<style>
body { font: 16px/1.5 system-ui, sans-serif; max-width: 640px; margin: 64px auto; padding: 0 24px; color: #1c1b1a; }
pre { white-space: pre-wrap; background: #f4f2ef; padding: 12px 16px; border-radius: 8px; }
code { font-size: 14px; }
</style></head>
<body>
<h1>Tapcue did not start</h1>
<pre>${escape(message)}</pre>
${log}
<p>Fix the problem, then start Tapcue again.</p>
</body>
</html>
`;
}

/** Writes the error page into `dir` and returns its path, or null when it cannot be written. */
export function writeErrorPage(
  dir: string,
  message: string,
  logPath: string | null,
): string | null {
  try {
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'tapcue-error.html');
    writeFileSync(path, errorPage(message, logPath));
    return path;
  } catch {
    return null;
  }
}
