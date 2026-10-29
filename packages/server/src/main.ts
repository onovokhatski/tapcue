// Entry point: read the config, load the project, build the app, and listen on every network
// interface, so tablets on the stand's network can reach it, not only this computer.
import { buildApp } from './app';
import { ConfigError, parseConfig } from './config';
import { loadProjectStore, ProjectLoadError } from './project/store';

try {
  const config = parseConfig(process.argv.slice(2), process.env, process.cwd());
  const store = await loadProjectStore(config.projectDir);
  const app = buildApp({ store, logger: true });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`Project "${store.project.name}" from ${store.dir}`);
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
