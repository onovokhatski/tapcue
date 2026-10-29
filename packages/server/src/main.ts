// Entry point: read the config, build the app, listen on every network interface,
// so tablets on the stand's network can reach it, not only this computer.
import { buildApp } from './app';
import { ConfigError, parseConfig } from './config';

try {
  const config = parseConfig(process.argv.slice(2), process.env, process.cwd());
  const app = buildApp({ logger: true });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`Project folder: ${config.projectDir}`);
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(`Tapcue cannot start: ${error.message}`);
  process.exit(1);
}
