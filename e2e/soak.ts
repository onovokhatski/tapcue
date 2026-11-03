// A long run of a stand without anyone touching it (spec NFR-3): the built app on a server of its
// own, in demo mode so nothing leaves the computer, a player tapping a hotspot every few seconds
// and the demo page open. Every minute it records the server's memory, the pages' memory and what
// was delivered; at the end it says whether the run passed.
//
//   npm run build
//   npm run soak -- --minutes 600
//
// macOS and Linux (it reads the server's memory with `ps`).
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Page } from '@playwright/test';
import type { Project } from '@tapcue/shared';
import { DEMO_DIR } from './stand';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = 4700;
const BASE = `http://localhost:${PORT}`;

const { values } = parseArgs({
  options: {
    minutes: { type: 'string', default: '600' },
    interval: { type: 'string', default: '5' },
    station: { type: 'string', default: 'main' },
  },
});
const minutes = Number(values.minutes);
const intervalMs = Number(values.interval) * 1000;

/** One line of the report, every minute. */
interface Sample {
  minute: number;
  serverRssMb: number;
  playerHeapMb: number | null;
  demoHeapMb: number | null;
  taps: number;
  delivered: number;
}

if (!existsSync(join(ROOT, 'packages/web/dist/index.html'))) {
  console.error('Build the web app first: npm run build');
  process.exit(1);
}

// A copy of the demo stand, so the run never touches examples/demo-stand.
const stand = mkdtempSync(join(tmpdir(), 'tapcue-soak-'));
cpSync(DEMO_DIR, stand, { recursive: true });
const server = spawn(
  process.execPath,
  [
    '--import',
    'tsx',
    'packages/server/src/main.ts',
    '--port',
    String(PORT),
    '--project',
    stand,
    '--demo',
  ],
  { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] },
);

const counts = {
  taps: 0,
  expected: 0,
  delivered: 0,
  sendErrors: 0,
  pageErrors: 0,
  reloads: 0,
  reconnects: 0,
};
const samples: Sample[] = [];

try {
  await waitForServer();
  const { project } = (await (await fetch(`${BASE}/api/project`)).json()) as { project: Project };
  const sends = new Set(
    project.pages.flatMap((p) => p.hotspots.filter((h) => h.action.command).map((h) => h.id)),
  );
  // A viewer of its own counts every delivery; the demo page keeps only the latest 200.
  const viewer = new WebSocket(`ws://localhost:${PORT}/ws`);
  viewer.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as { type: string; entry?: { status: string } };
    // The server closes a connection that stops answering its pings (architecture §7).
    if (message.type === 'ping') viewer.send(JSON.stringify({ type: 'pong' }));
    if (message.type === 'demo-received') counts.delivered += 1;
    if (message.type === 'log-entry' && message.entry?.status === 'error') counts.sendErrors += 1;
  });

  const browser = await chromium.launch();
  const demo = await browser.newPage();
  const player = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  for (const page of [demo, player]) {
    page.on('pageerror', () => (counts.pageErrors += 1));
    page.on('console', (message) => {
      if (message.type() === 'error') counts.pageErrors += 1;
    });
  }
  player.on('framenavigated', (frame) => {
    if (frame === player.mainFrame()) counts.reloads += 1;
  });
  await demo.goto(`${BASE}/demo`);
  await player.goto(`${BASE}/play/${values.station}`);
  counts.reloads = 0; // the first load is not a reload

  const end = Date.now() + minutes * 60_000;
  const start = Date.now();
  let nextSample = start;
  let indicatorShown = false;
  while (Date.now() < end) {
    const id = await tapSomething(player);
    if (id) {
      counts.taps += 1;
      if (sends.has(id)) counts.expected += 1;
    }
    const indicator = await player.locator('.connection-indicator').isVisible();
    if (indicator && !indicatorShown) counts.reconnects += 1;
    indicatorShown = indicator;
    if (Date.now() >= nextSample) {
      samples.push(await sample(Math.round((Date.now() - start) / 60_000), player, demo));
      const last = samples.at(-1)!;
      console.log(
        `${last.minute} min · server ${last.serverRssMb} MB · player ${last.playerHeapMb} MB · ` +
          `taps ${counts.taps} · delivered ${counts.delivered}/${counts.expected}`,
      );
      nextSample += 60_000;
    }
    await player.waitForTimeout(intervalMs);
  }
  await player.waitForTimeout(2000); // the last delivery
  samples.push(await sample(minutes, player, demo));
  await browser.close();
  viewer.close();
  report();
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

/** Taps a random hotspot of the page on screen; returns its id. */
async function tapSomething(page: Page): Promise<string | null> {
  const hotspots = page.locator('[data-layer="shown"] [data-hotspot]');
  const count = await hotspots.count();
  if (count === 0) return null;
  const hotspot = hotspots.nth(Math.floor(Math.random() * count));
  const id = await hotspot.getAttribute('data-hotspot');
  // A tap that does not land (a page fading in front of it) is not counted.
  const landed = await hotspot.click({ timeout: 2000 }).then(
    () => true,
    () => false,
  );
  return landed ? id : null;
}

async function sample(minute: number, player: Page, demo: Page): Promise<Sample> {
  const rssKb = Number(execFileSync('ps', ['-o', 'rss=', '-p', String(server.pid)]).toString());
  return {
    minute,
    serverRssMb: Math.round(rssKb / 1024),
    playerHeapMb: await heapMb(player),
    demoHeapMb: await heapMb(demo),
    taps: counts.taps,
    delivered: counts.delivered,
  };
}

/** Chromium's JS heap after its garbage collector, in MB. */
async function heapMb(page: Page): Promise<number | null> {
  const bytes = await page.evaluate(
    () =>
      (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
  );
  return bytes === undefined ? null : Math.round(bytes / 1024 / 1024);
}

function report() {
  const settled = samples.find((s) => s.minute >= 5) ?? samples[0]!;
  const last = samples.at(-1)!;
  const problems = [
    counts.delivered !== counts.expected &&
      `delivered ${counts.delivered} of ${counts.expected} commands`,
    counts.sendErrors > 0 && `${counts.sendErrors} send errors`,
    counts.pageErrors > 0 && `${counts.pageErrors} page errors`,
    counts.reloads > 0 && `the player reloaded ${counts.reloads} times`,
    counts.reconnects > 0 && `the player lost its connection ${counts.reconnects} times`,
  ].filter(Boolean);
  const summary = {
    minutes,
    ...counts,
    serverRssMb: { settled: settled.serverRssMb, end: last.serverRssMb },
    playerHeapMb: { settled: settled.playerHeapMb, end: last.playerHeapMb },
    passed: problems.length === 0,
    problems,
  };
  const dir = join(ROOT, 'e2e/soak-results');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `soak-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, `${JSON.stringify({ summary, samples }, null, 2)}\n`);
  console.log(`\n${JSON.stringify(summary, null, 2)}\nSamples: ${file}`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}
