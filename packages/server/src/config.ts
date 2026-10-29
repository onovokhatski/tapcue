// Server settings from command-line arguments, then environment variables, then defaults.
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

export interface Config {
  port: number;
  /** Absolute path of the project folder (project.json + assets/). */
  projectDir: string;
}

export const DEFAULT_PORT = 4000;
export const DEFAULT_PROJECT_DIR = resolve(import.meta.dirname, '../../../examples/demo-stand');

export class ConfigError extends Error {}

/**
 * `tapcue --port 4000 --project ./my-stand`, or TAPCUE_PORT / TAPCUE_PROJECT.
 * Relative project paths are resolved against `cwd`, where the command was run.
 */
export function parseConfig(
  argv: string[],
  env: Record<string, string | undefined>,
  cwd: string,
): Config {
  let values: { port?: string | undefined; project?: string | undefined };
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { port: { type: 'string' }, project: { type: 'string' } },
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
  const projectDir = projectPath === undefined ? DEFAULT_PROJECT_DIR : resolve(cwd, projectPath);

  return { port, projectDir };
}
