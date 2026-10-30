// End-to-end tests: the real server and web app, driven in a real browser (architecture §8).
// Run with `npm run test:e2e`. Locally, servers that are already running are reused.
import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: '.',
  outputDir: 'test-results',
  // One flow at a time: every test shares the one server and its demo receiver.
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The server must be on its default port: the demo project's HTTP target is localhost:4000.
  webServer: [
    {
      command: 'npm run dev -w @tapcue/server',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: !CI,
      cwd: '..',
    },
    {
      command: 'npm run dev -w @tapcue/web',
      url: 'http://localhost:5173',
      reuseExistingServer: !CI,
      cwd: '..',
    },
  ],
});
