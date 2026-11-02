// Entry point: read the config, load the project, build the app (with the web app's build when there
// is one), and listen on every network interface, so tablets on the stand's network can reach it.
import { buildApp } from './app';
import { startBanner } from './banner';
import { ConfigError, parseConfig, WEB_DIR } from './config';
import { localAddresses } from './network';
import { loadProjectStore, ProjectLoadError } from './project/store';
import { hasWebBuild } from './webApp';

try {
  // npm runs this from packages/server; INIT_CWD is where the command was typed, so a relative
  // --project means what the integrator expects.
  const cwd = process.env['INIT_CWD'] ?? process.cwd();
  const config = parseConfig(process.argv.slice(2), process.env, cwd);
  const store = await loadProjectStore(config.projectDir);
  const app = buildApp({ store, logger: true, webDir: WEB_DIR });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`Project "${store.project.name}" from ${store.dir}`);
  // Only with the build: in development the editor is on the web app's port, not this one.
  if (hasWebBuild(WEB_DIR)) {
    const lines = startBanner({
      projectName: store.project.name,
      port: config.port,
      addresses: localAddresses(),
      stations: store.project.stations,
    });
    console.log(`\n${lines.join('\n')}\n`);
  }
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`Tapcue cannot start: ${error.message}`);
  } else if (error instanceof ProjectLoadError) {
    console.error(`Tapcue cannot start. ${error.message}:`);
    for (const problem of error.errors) console.error(`  ${problem.path}: ${problem.message}`);
  } else {
    throw error;
  }
  process.exit(1);
}
