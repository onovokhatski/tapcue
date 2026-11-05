// The README's screenshots and its short player tour, made again with one command whenever the UI
// changes: the built app on a server of its own, with a copy of the demo stand.
//
//   npm run build
//   npm run media
//
// The copy points the demo's OSC and UDP targets at 127.0.0.1, so the tour sends nothing onto the
// network, and its HTTP target at this server's demo receiver, so the demo page fills up.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { type Browser, chromium, type Page } from '@playwright/test';
import { DEMO_DIR, standProject } from './stand';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'docs/media');
const PORT = 4800;
const BASE = `http://localhost:${PORT}`;

if (!existsSync(join(ROOT, 'packages/web/dist/index.html'))) {
  console.error('Build the web app first: npm run build');
  process.exit(1);
}

const stand = mkdtempSync(join(tmpdir(), 'tapcue-media-'));
cpSync(DEMO_DIR, stand, { recursive: true });
const project = standProject();
for (const target of project.targets) {
  if (target.protocol === 'http') target.baseUrl = BASE;
  else target.host = '127.0.0.1';
}
writeFileSync(join(stand, 'project.json'), JSON.stringify(project, null, 2));
const server = spawn(
  process.execPath,
  ['--import', 'tsx', 'packages/server/src/main.ts', '--port', String(PORT), '--project', stand],
  { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] },
);

try {
  await waitForServer();
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  await editorShots(browser);
  await playerAndDemoShots(browser);
  await playerTour(browser);
  await browser.close();
  console.log(`Written to ${OUT}`);
} finally {
  server.kill();
  rmSync(stand, { recursive: true, force: true });
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`The server did not start on port ${PORT}`);
}

/** The Pages tab with a hotspot selected, and the Stations tab with its QR code. */
async function editorShots(browser: Browser) {
  const editor = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await editor.goto(`${BASE}/edit/pages`);
  await editor.getByRole('banner').getByText('Saved').waitFor();
  await editor
    .getByRole('region', { name: 'Canvas' })
    .getByRole('button', { name: 'Product A card' })
    .click();
  await settle(editor);
  await editor.screenshot({ path: join(OUT, 'editor.png') });

  await editor.getByRole('link', { name: 'Stations' }).click();
  await editor.getByRole('img', { name: /QR code for/ }).waitFor();
  await settle(editor);
  await editor.screenshot({ path: join(OUT, 'stations.png') });
  await editor.close();
}

/** Home in the player, and the demo page after two taps that reach it. */
async function playerAndDemoShots(browser: Browser) {
  const demo = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await demo.goto(`${BASE}/demo`);
  await demo.getByText('Waiting for the first command').waitFor();
  const player = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await player.goto(`${BASE}/play/main`);
  await settle(player);
  await player.screenshot({ path: join(OUT, 'player.png') });

  await tap(player, 'h_call00'); // Call our team → screen-3
  await tap(player, 'h_carda0'); // Product A card → the Product A page
  await tap(player, 'h_aplay0'); // Play demo → screen-1
  await demo.getByText('Receiving · 2 requests').waitFor();
  await settle(demo);
  await demo.screenshot({ path: join(OUT, 'demo-receiver.png') });
  await player.close();
  await demo.close();
}

/** About 15 s of a visitor browsing the demo stand, as a video. */
async function playerTour(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    recordVideo: { dir: join(OUT, '.video'), size: { width: 1024, height: 768 } },
  });
  const player = await context.newPage();
  await player.goto(`${BASE}/play/main`);
  await settle(player);
  for (const hotspot of ['h_carda0', 'h_aplay0', 'h_anext0', 'h_bback0', 'h_about0', 'h_abtbk0']) {
    await tap(player, hotspot);
    await player.waitForTimeout(1500);
  }
  await context.close();
  await player.video()!.saveAs(join(OUT, 'player-tour.webm'));
  rmSync(join(OUT, '.video'), { recursive: true, force: true });
}

async function tap(page: Page, hotspotId: string) {
  await page.locator(`[data-layer="shown"] [data-hotspot="${hotspotId}"]`).click();
  // The page change waits for the press effect and the fade (about half a second).
  await page.waitForTimeout(900);
}

/** Lets images, videos and fades finish before a screenshot. */
function settle(page: Page) {
  return page.waitForTimeout(1200);
}
