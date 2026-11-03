// End-to-end tests: the real server and web app, driven in a real browser (architecture §8).
// Run with `npm run test:e2e`. They run on a copy of the demo project, on ports of their own
// (e2e/stand.ts), so they never change examples/demo-stand or a server already running on 4000.
import { defineConfig, devices } from '@playwright/test';
import { prepareStand, SERVER_PORT, SERVER_URL, WEB_PORT, WEB_URL } from './stand';

const CI = Boolean(process.env['CI']);
const stand = prepareStand();

export default defineConfig({
  testDir: '.',
  outputDir: 'test-results',
  // One flow at a time: every test shares the one server, its project and its demo receiver.
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? 'line' : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
  },
  // The player's target is Safari on iPadOS (WebKit); the editor's also Chrome and Firefox (spec NFR-1).
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: [
    {
      command: `npx tsx packages/server/src/main.ts --port ${SERVER_PORT} --project "${stand}"`,
      url: `${SERVER_URL}/api/health`,
      cwd: '..',
    },
    {
      command: `npm run dev -w @tapcue/web -- --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      cwd: '..',
      env: { TAPCUE_SERVER: SERVER_URL },
    },
  ],
});
