import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigError } from './config';
import { ProjectLoadError } from './project/store';
import { portInUse, reportStartError } from './start';

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
