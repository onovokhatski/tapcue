import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { browserCommand, defaultProjectDir, prepareDefaultProject, resourcesDir } from './launcher';

describe('resourcesDir (ADR 0017)', () => {
  it('finds the web app in a macOS bundle’s Resources folder', () => {
    const exe = '/Applications/Tapcue.app/Contents/MacOS/tapcue';
    const exists = (path: string) => path === '/Applications/Tapcue.app/Contents/Resources/web';
    expect(resourcesDir(exe, exists)).toBe('/Applications/Tapcue.app/Contents/Resources');
  });

  it('otherwise uses the executable’s own folder, as in the Windows download', () => {
    expect(resourcesDir('/Downloads/Tapcue/Tapcue.exe', () => false)).toBe('/Downloads/Tapcue');
  });
});

describe('defaultProjectDir', () => {
  it('is a demo stand in Documents/Tapcue', () => {
    expect(defaultProjectDir('/Users/ann')).toBe('/Users/ann/Documents/Tapcue/demo-stand');
  });
});

describe('browserCommand', () => {
  it.each([
    ['darwin', ['open', ['http://localhost:4000/edit']]],
    ['win32', ['cmd', ['/c', 'start', '""', 'http://localhost:4000/edit']]],
    ['linux', ['xdg-open', ['http://localhost:4000/edit']]],
  ] as const)('opens the editor on %s', (platform, command) => {
    expect(browserCommand(platform, 'http://localhost:4000/edit')).toEqual(command);
  });
});

describe('prepareDefaultProject', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function folders() {
    const root = mkdtempSync(join(tmpdir(), 'tapcue-packaged-'));
    dirs.push(root);
    const demo = join(root, 'demo');
    mkdirSync(demo);
    writeFileSync(join(demo, 'project.json'), '{"name":"Demo stand"}');
    return { root, demo, defaultDir: join(root, 'Documents', 'Tapcue', 'demo-stand') };
  }

  it('copies the demo stand into the default folder on the first start', () => {
    const { demo, defaultDir } = folders();
    prepareDefaultProject(defaultDir, defaultDir, demo);
    expect(readFileSync(join(defaultDir, 'project.json'), 'utf8')).toBe('{"name":"Demo stand"}');
  });

  it('leaves a project that is there already', () => {
    const { demo, defaultDir } = folders();
    mkdirSync(defaultDir, { recursive: true });
    writeFileSync(join(defaultDir, 'project.json'), '{"name":"My stand"}');
    prepareDefaultProject(defaultDir, defaultDir, demo);
    expect(readFileSync(join(defaultDir, 'project.json'), 'utf8')).toBe('{"name":"My stand"}');
  });

  it('never fills in a folder the integrator named', () => {
    const { root, demo, defaultDir } = folders();
    const named = join(root, 'my-stand');
    prepareDefaultProject(named, defaultDir, demo);
    expect(() => readFileSync(join(named, 'project.json'))).toThrow();
  });
});
