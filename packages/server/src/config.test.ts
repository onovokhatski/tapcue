import { describe, expect, it } from 'vitest';
import { ConfigError, DEFAULT_PORT, DEFAULT_PROJECT_DIR, parseConfig } from './config';

const cwd = '/home/stand';

describe('parseConfig', () => {
  it('uses the defaults when nothing is given', () => {
    expect(parseConfig([], {}, cwd)).toEqual({
      port: DEFAULT_PORT,
      projectDir: DEFAULT_PROJECT_DIR,
    });
  });

  it('defaults to the demo stand in examples/', () => {
    expect(DEFAULT_PROJECT_DIR).toMatch(/examples\/demo-stand$/);
  });

  it('reads command-line arguments and resolves the project against the working folder', () => {
    expect(parseConfig(['--port', '8080', '--project', 'my-stand'], {}, cwd)).toEqual({
      port: 8080,
      projectDir: '/home/stand/my-stand',
    });
  });

  it('reads environment variables', () => {
    const env = { TAPCUE_PORT: '5000', TAPCUE_PROJECT: '/srv/stand' };
    expect(parseConfig([], env, cwd)).toEqual({ port: 5000, projectDir: '/srv/stand' });
  });

  it('prefers command-line arguments over environment variables', () => {
    expect(parseConfig(['--port', '8080'], { TAPCUE_PORT: '5000' }, cwd).port).toBe(8080);
  });

  it.each(['0', '65536', '80.5', 'http', ''])(
    'rejects port "%s" with a readable message',
    (port) => {
      expect(() => parseConfig(['--port', port], {}, cwd)).toThrow(
        new ConfigError(`Port must be a whole number from 1 to 65535, got "${port}"`),
      );
    },
  );

  it('rejects an unknown option as a config error', () => {
    expect(() => parseConfig(['--prot', '8080'], {}, cwd)).toThrow(ConfigError);
  });
});
