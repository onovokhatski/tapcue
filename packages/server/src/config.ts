// Server settings from command-line arguments, then environment variables, then defaults.
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

export interface Config {
  port: number;
  /** Absolute path of the project folder (project.json + assets/). */
  projectDir: string;
  /** The public online demo: nothing is saved, commands go to the demo receiver (spec DEMO-3). */
  demo: boolean;
}

export const DEFAULT_PORT = 4000;
export const DEFAULT_PROJECT_DIR = resolve(import.meta.dirname, '../../../examples/demo-stand');
/** The web app's production build, made by `npm run build`. */
export const WEB_DIR = resolve(import.meta.dirname, '../../web/dist');

export class ConfigError extends Error {}

/**
 * `tapcue --port 4000 --project ./my-stand --demo`, or TAPCUE_PORT / TAPCUE_PROJECT / TAPCUE_DEMO=1.
 * Relative project paths are resolved against `cwd`, where the command was run. Without a project,
 * `defaultProjectDir`: the demo stand in the repository, or the click-to-run app's own folder.
 */
export function parseConfig(
  argv: string[],
  env: Record<string, string | undefined>,
  cwd: string,
  defaultProjectDir = DEFAULT_PROJECT_DIR,
): Config {
  let values: {
    port?: string | undefined;
    project?: string | undefined;
    demo?: boolean | undefined;
  };
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { port: { type: 'string' }, project: { type: 'string' }, demo: { type: 'boolean' } },
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

  const demo = values.demo ?? ['1', 'true'].includes(env['TAPCUE_DEMO'] ?? '');

  return { port, projectDir, demo };
}
