// Starting Tapcue: load the project, build the app, listen on every network interface, so tablets on
// the stand's network can reach it, and print where to go. Shared by `npm start` and `npm run dev`
// (main.ts) and the click-to-run app (packaged.ts).
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { startBanner } from './banner';
import { type Config, ConfigError } from './config';
import { localAddresses } from './network';
import { loadProjectStore, ProjectLoadError } from './project/store';
import { hasWebBuild } from './webApp';

/** `quittable`: the click-to-run app, which the editor can stop (POST /api/quit). */
export async function startServer(
  config: Config,
  webDir: string,
  { quittable = false } = {},
): Promise<FastifyInstance> {
  const store = await loadProjectStore(config.projectDir);
  const quit = () => {
    app.log.info('Quit from the editor');
    void app.close().then(() => process.exit(0));
  };
  const app = buildApp({
    store,
    logger: true,
    webDir,
    demo: config.demo,
    ...(quittable ? { onQuit: quit } : {}),
  });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`Project "${store.project.name}" from ${store.dir}`);
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

/** The port another program holds, from Node's listen error; null for any other error. */
export function portInUse(error: unknown): number | null {
  const { code, port } = error as { code?: unknown; port?: unknown };
  return code === 'EADDRINUSE' && typeof port === 'number' ? port : null;
}

/** Says why Tapcue cannot start, for problems a person can fix; false for anything else. */
export function reportStartError(error: unknown): boolean {
  const port = portInUse(error);
  if (error instanceof ConfigError) {
    console.error(`Tapcue cannot start: ${error.message}`);
  } else if (error instanceof ProjectLoadError) {
    console.error(`Tapcue cannot start. ${error.message}:`);
    for (const problem of error.errors) console.error(`  ${problem.path}: ${problem.message}`);
  } else if (port !== null) {
    console.error(
      `Tapcue cannot start: port ${port} is in use by another program. ` +
        `Close it, or start Tapcue on another port with --port ${port + 1}.`,
    );
  } else {
    return false;
  }
  return true;
}
