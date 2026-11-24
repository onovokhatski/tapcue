// Starting Tapcue: load the project, build the app, listen on every network interface, so tablets on
// the stand's network can reach it, and print where to go. Shared by `npm start` and `npm run dev`
// (main.ts) and the click-to-run app (packaged.ts).
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { startBanner } from './banner';
import { type Config, ConfigError } from './config';
import { localAddresses } from './network';
import { createLibrary, type Library } from './project/library';
import { loadProjectStore, ProjectLoadError } from './project/store';
import { hasWebBuild } from './webApp';

/**
 * `quittable`: the click-to-run app, which the editor can stop (POST /api/quit). `log`: where the
 * server's log goes instead of stdout, the app's log file (issue #230).
 */
export async function startServer(
  config: Config,
  webDir: string,
  { quittable = false, log }: { quittable?: boolean; log?: { write(text: string): void } } = {},
): Promise<FastifyInstance> {
  const library = createLibrary(config.projectsDir);
  const store = await loadProjectStore(await startDir(config, library));
  const quit = () => {
    app.log.info('Quit from the editor');
    void app.close().then(() => process.exit(0));
  };
  const app = buildApp({
    store,
    library,
    logger: log ? { stream: log } : true,
    webDir,
    demo: config.demo,
    ...(quittable ? { onQuit: quit } : {}),
  });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`Project "${store.project.name}" from ${store.dir}`);
  app.log.info(`Projects library: ${library.dir}`);
  if (config.demo) app.log.info('Demo mode: nothing is saved, commands go to the demo receiver');
  // Only with the build: in development the editor is on the web app's port, not this one.
  if (hasWebBuild(webDir)) {
    const lines = startBanner({
      projectName: store.project.name,
      port: config.port,
      addresses: localAddresses(),
      stations: store.project.stations,
    });
    console.log(`\n${lines.join('\n')}\n`);
  }
  return app;
}

/**
 * The project to start (spec PRJ-1): the one the integrator named, else the one last opened from
 * the library, else the default. The online demo always starts its own project (spec DEMO-3).
 */
export async function startDir(config: Config, library: Library): Promise<string> {
  if (config.projectGiven || config.demo) return config.projectDir;
  return (await library.remembered()) ?? config.projectDir;
}

/** The port another program holds, from Node's listen error; null for any other error. */
export function portInUse(error: unknown): number | null {
  const { code, port } = error as { code?: unknown; port?: unknown };
  return code === 'EADDRINUSE' && typeof port === 'number' ? port : null;
}

/** Why Tapcue cannot start, for problems a person can fix; null for anything else. */
export function startErrorMessage(error: unknown): string | null {
  const port = portInUse(error);
  if (error instanceof ConfigError) return `Tapcue cannot start: ${error.message}`;
  if (error instanceof ProjectLoadError) {
    const problems = error.errors.map((problem) => `  ${problem.path}: ${problem.message}`);
    return [`Tapcue cannot start. ${error.message}:`, ...problems].join('\n');
  }
  if (port !== null) {
    return (
      `Tapcue cannot start: port ${port} is in use by another program. ` +
      `Close it, or start Tapcue on another port with --port ${port + 1}.`
    );
  }
  return null;
}

/** Says why Tapcue cannot start, for problems a person can fix; false for anything else. */
export function reportStartError(error: unknown): boolean {
  const message = startErrorMessage(error);
  if (message === null) return false;
  for (const line of message.split('\n')) console.error(line);
  return true;
}
