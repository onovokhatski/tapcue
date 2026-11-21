import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Config, ConfigError } from './config';
import type { Library } from './project/library';
import { ProjectLoadError } from './project/store';
import { portInUse, reportStartError, startDir } from './start';

const busy = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE', port: 4000 });

describe('portInUse', () => {
  it('reads the port from Node’s listen error', () => {
    expect(portInUse(busy)).toBe(4000);
    expect(portInUse(new Error('other'))).toBeNull();
    expect(portInUse({ code: 'EACCES', port: 80 })).toBeNull();
  });
});

describe('reportStartError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const errors = () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    return () => error.mock.calls.map((call) => String(call[0]));
  };

  it('says which port is taken and how to start on another one', () => {
    const lines = errors();
    expect(reportStartError(busy)).toBe(true);
    expect(lines()).toEqual([
      'Tapcue cannot start: port 4000 is in use by another program. Close it, or start Tapcue on another port with --port 4001.',
    ]);
  });

  it('reports a bad option and an invalid project', () => {
    const lines = errors();
    expect(reportStartError(new ConfigError('Port must be a whole number'))).toBe(true);
    expect(
      reportStartError(
        new ProjectLoadError('/stand', [{ path: 'name', message: 'Expected a name' }]),
      ),
    ).toBe(true);
    expect(lines()).toEqual([
      'Tapcue cannot start: Port must be a whole number',
      'Tapcue cannot start. The project in /stand has 1 problem:',
      '  name: Expected a name',
    ]);
  });

  it('leaves any other error to crash with its stack', () => {
    errors();
    expect(reportStartError(new TypeError('a bug'))).toBe(false);
  });
});

describe('startDir (spec PRJ-1)', () => {
  const library = (remembered: string | null) =>
    ({ remembered: () => Promise.resolve(remembered) }) as unknown as Library;
  const config = (overrides: Partial<Config>): Config => ({
    port: 4000,
    projectDir: '/default',
    projectGiven: false,
    projectsDir: '/library',
    demo: false,
    ...overrides,
  });

  it('starts the project the integrator named, whatever was opened last', async () => {
    const named = config({ projectDir: '/named', projectGiven: true });
    expect(await startDir(named, library('/library/last'))).toBe('/named');
  });

  it('starts the project last opened from the library, else the default', async () => {
    expect(await startDir(config({}), library('/library/last'))).toBe('/library/last');
    expect(await startDir(config({}), library(null))).toBe('/default');
  });

  it('always starts its own project in the online demo (spec DEMO-3)', async () => {
    expect(await startDir(config({ demo: true }), library('/library/last'))).toBe('/default');
  });
});
