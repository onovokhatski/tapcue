// Entry point for `npm start` and `npm run dev`: read the config and start Tapcue, with the web app's
// build when there is one. The click-to-run app has its own entry (packaged.ts).
import { parseConfig, WEB_DIR } from './config';
import { reportStartError, startServer } from './start';

try {
  // npm runs this from packages/server; INIT_CWD is where the command was typed, so a relative
  // --project means what the integrator expects.
  const cwd = process.env['INIT_CWD'] ?? process.cwd();
  await startServer(parseConfig(process.argv.slice(2), process.env, cwd), WEB_DIR);
} catch (error) {
  if (!reportStartError(error)) throw error;
  process.exit(1);
}
