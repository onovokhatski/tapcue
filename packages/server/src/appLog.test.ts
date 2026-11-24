import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  errorPage,
  LOG_FILE,
  MAX_LOG_BYTES,
  openAppLog,
  routeConsole,
  writeErrorPage,
} from './appLog';

const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'tapcue-log-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    chmodSync(dir, 0o755);
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('openAppLog (issue #230)', () => {
  it('creates the folder and the log, and appends to what an earlier start wrote', () => {
    const dir = join(tempDir(), 'Documents', 'Tapcue');
    const first = openAppLog(dir)!;
    expect(first.path).toBe(join(dir, LOG_FILE));
    first.write('one\n');
    // Written at once, before anything is closed: the app may exit right after.
    expect(readFileSync(first.path, 'utf8')).toBe('one\n');
    openAppLog(dir)!.write('two\n');
    expect(readFileSync(first.path, 'utf8')).toBe('one\ntwo\n');
  });

  it('keeps a log grown too big once as tapcue.old.log, and starts a new one', () => {
    const dir = tempDir();
    writeFileSync(join(dir, LOG_FILE), 'x'.repeat(MAX_LOG_BYTES + 1));
    const log = openAppLog(dir)!;
    log.write('fresh\n');
    expect(readFileSync(log.path, 'utf8')).toBe('fresh\n');
    expect(readFileSync(join(dir, 'tapcue.old.log'), 'utf8')).toHaveLength(MAX_LOG_BYTES + 1);
  });

  it('keeps a log of exactly the limit', () => {
    const dir = tempDir();
    writeFileSync(join(dir, LOG_FILE), 'x'.repeat(MAX_LOG_BYTES));
    openAppLog(dir)!.write('more\n');
    expect(existsSync(join(dir, 'tapcue.old.log'))).toBe(false);
    expect(readFileSync(join(dir, LOG_FILE), 'utf8')).toHaveLength(MAX_LOG_BYTES + 5);
  });

  it('is null when the folder cannot be written', () => {
    const dir = tempDir();
    chmodSync(dir, 0o500);
    expect(openAppLog(join(dir, 'Tapcue'))).toBeNull();
  });
});

describe('routeConsole', () => {
  it('sends every console method to the log, one line each, formatted as the console would', () => {
    const lines: string[] = [];
    const target = { ...console };
    routeConsole({ path: 'log', write: (text) => lines.push(text) }, target);
    target.log('Port %d', 4000);
    target.info('info');
    target.warn('warn', { a: 1 });
    target.error('error');
    expect(lines).toEqual(['Port 4000\n', 'info\n', 'warn { a: 1 }\n', 'error\n']);
  });
});

describe('the start-error page', () => {
  it('says why and where the log is, with the message escaped', () => {
    const page = errorPage(
      'Project <"Hall"> & co is invalid',
      '/Users/ann/Documents/Tapcue/tapcue.log',
    );
    expect(page).toContain('<title>Tapcue did not start</title>');
    expect(page).toContain('<pre>Project &lt;&quot;Hall&quot;&gt; &amp; co is invalid</pre>');
    expect(page).toContain('<code>/Users/ann/Documents/Tapcue/tapcue.log</code>');
    expect(errorPage('x', null)).toContain('No log could be written.');
  });

  it('is written into the folder, or not at all when it cannot be', () => {
    const dir = tempDir();
    const path = writeErrorPage(dir, 'Port 4000 is in use', null)!;
    expect(path).toBe(join(dir, 'tapcue-error.html'));
    expect(readFileSync(path, 'utf8')).toContain('Port 4000 is in use');
    chmodSync(dir, 0o500);
    expect(writeErrorPage(join(dir, 'sub'), 'x', null)).toBeNull();
  });
});
