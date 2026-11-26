// Server settings from command-line arguments, then environment variables, then defaults.
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

export interface Config {
  port: number;
  /** Absolute path of the project folder (project.json + assets/) to start with. */
  projectDir: string;
  /**
   * Whether the integrator named the project (--project, TAPCUE_PROJECT). If not, the project last
   * opened from the library is started instead of `projectDir`, the default (ADR 0021).
   */
  projectGiven: boolean;
  /** Absolute path of the library: the folder whose subfolders are projects (ADR 0021). */
  projectsDir: string;
  /** The public online demo: nothing is saved, commands go to the demo receiver (spec DEMO-3). */
  demo: boolean;
}

export const DEFAULT_PORT = 4000;
export const DEFAULT_PROJECT_DIR = resolve(import.meta.dirname, '../../../examples/demo-stand');

/** The library by default, for `npm start` and the click-to-run app alike (ADR 0017, 0021). */
export function defaultProjectsDir(home: string): string {
  return join(home, 'Documents', 'Tapcue');
}
/** The web app's production build, made by `npm run build`. */
export const WEB_DIR = resolve(import.meta.dirname, '../../web/dist');

export class ConfigError extends Error {}

/**
 * `tapcue --port 4000 --project ./my-stand --projects ./stands --demo`, or TAPCUE_PORT /
 * TAPCUE_PROJECT / TAPCUE_PROJECTS / TAPCUE_DEMO=1. Relative paths are resolved against `cwd`,
 * where the command was run. Without a project, `defaultProjectDir`: the demo stand in the
 * repository, or the click-to-run app's own copy. Without a library, `defaultProjectsDir`.
 */
export function parseConfig(
  argv: string[],
  env: Record<string, string | undefined>,
  cwd: string,
  {
    defaultProjectDir = DEFAULT_PROJECT_DIR,
    home = homedir(),
  }: { defaultProjectDir?: string; home?: string } = {},
): Config {
  let values: {
    port?: string | undefined;
    project?: string | undefined;
    projects?: string | undefined;
    demo?: boolean | undefined;
  };
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        port: { type: 'string' },
        project: { type: 'string' },
        projects: { type: 'string' },
        demo: { type: 'boolean' },
      },
      strict: true,
    }));
  } catch (error) {
    // e.g. an unknown option: report it as a config problem, not as a crash.
    throw new ConfigError(error instanceof Error ? error.message : String(error));
  }

  const portText = values.port ?? env['TAPCUE_PORT'];
  const port = portText === undefined ? DEFAULT_PORT : Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`Port must be a whole number from 1 to 65535, got "${portText}"`);
  }

  const projectPath = values.project ?? env['TAPCUE_PROJECT'];
  const projectDir = projectPath === undefined ? defaultProjectDir : resolve(cwd, projectPath);

  const projectsPath = values.projects ?? env['TAPCUE_PROJECTS'];
  const projectsDir =
    projectsPath === undefined ? defaultProjectsDir(home) : resolve(cwd, projectsPath);

  const demo = values.demo ?? ['1', 'true'].includes(env['TAPCUE_DEMO'] ?? '');

  return { port, projectDir, projectGiven: projectPath !== undefined, projectsDir, demo };
}
