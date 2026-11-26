import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  DEFAULT_PORT,
  DEFAULT_PROJECT_DIR,
  defaultProjectsDir,
  parseConfig,
} from './config';

const cwd = '/home/stand';
const home = '/Users/ann';

describe('parseConfig', () => {
  it('uses the defaults when nothing is given', () => {
    expect(parseConfig([], {}, cwd, { home })).toEqual({
      port: DEFAULT_PORT,
      projectDir: DEFAULT_PROJECT_DIR,
      projectGiven: false,
      projectsDir: '/Users/ann/Documents/Tapcue',
      demo: false,
    });
  });

  it('defaults to the demo stand in examples/', () => {
    expect(DEFAULT_PROJECT_DIR).toMatch(/examples\/demo-stand$/);
  });

  it('reads command-line arguments and resolves the project against the working folder', () => {
    const argv = ['--port', '8080', '--project', 'my-stand', '--projects', 'stands'];
    expect(parseConfig(argv, {}, cwd, { home })).toEqual({
      port: 8080,
      projectDir: '/home/stand/my-stand',
      projectGiven: true,
      projectsDir: '/home/stand/stands',
      demo: false,
    });
  });

  it('reads environment variables', () => {
    const env = { TAPCUE_PORT: '5000', TAPCUE_PROJECT: '/srv/stand', TAPCUE_PROJECTS: '/srv/all' };
    expect(parseConfig([], env, cwd, { home })).toEqual({
      port: 5000,
      projectDir: '/srv/stand',
      projectGiven: true,
      projectsDir: '/srv/all',
      demo: false,
    });
  });

  it('takes the default project from the caller, as the click-to-run app does', () => {
    const config = parseConfig([], {}, cwd, {
      defaultProjectDir: '/Users/ann/Documents/Tapcue/demo-stand',
    });
    expect(config.projectDir).toBe('/Users/ann/Documents/Tapcue/demo-stand');
    expect(config.projectGiven).toBe(false);
  });

  it('keeps the library in Documents/Tapcue by default (ADR 0021)', () => {
    expect(defaultProjectsDir('/Users/ann')).toBe('/Users/ann/Documents/Tapcue');
  });

  it('prefers command-line arguments over environment variables', () => {
    expect(parseConfig(['--port', '8080'], { TAPCUE_PORT: '5000' }, cwd).port).toBe(8080);
    const env = { TAPCUE_PROJECTS: '/srv/all' };
    expect(parseConfig(['--projects', 'mine'], env, cwd).projectsDir).toBe('/home/stand/mine');
  });

  it.each(['0', '65536', '80.5', 'http', ''])(
    'rejects port "%s" with a readable message',
    (port) => {
      expect(() => parseConfig(['--port', port], {}, cwd)).toThrow(
        new ConfigError(`Port must be a whole number from 1 to 65535, got "${port}"`),
      );
    },
  );

  it('turns demo mode on with --demo or TAPCUE_DEMO=1 / true (spec DEMO-3)', () => {
    expect(parseConfig(['--demo'], {}, cwd).demo).toBe(true);
    expect(parseConfig([], { TAPCUE_DEMO: '1' }, cwd).demo).toBe(true);
    expect(parseConfig([], { TAPCUE_DEMO: 'true' }, cwd).demo).toBe(true);
    expect(parseConfig([], { TAPCUE_DEMO: '0' }, cwd).demo).toBe(false);
    expect(parseConfig([], { TAPCUE_DEMO: '' }, cwd).demo).toBe(false);
  });

  it('rejects an unknown option as a config error', () => {
    expect(() => parseConfig(['--prot', '8080'], {}, cwd)).toThrow(ConfigError);
  });
});
