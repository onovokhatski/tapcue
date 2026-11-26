// The v0.9 "done when": a mini-site uploaded as a page background in the editor appears on the open
// tablet, a link inside it works, a hotspot over it goes to another page, and after the web page
// time the tablet is back on the station's start page (spec PG-7, PG-8, PG-10, roadmap v0.9).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { expect, type Page, test } from '@playwright/test';
import yazl from 'yazl';
import { DEMO_DIR, SERVER_URL, standProject } from './stand';

/** The demo project as it is in git; the tests must leave it so. */
const demoOnDisk = readFileSync(join(DEMO_DIR, 'project.json'), 'utf8');

/** 500 ms of quiet before the editor saves, then save, broadcast, fetch and draw. */
const FOLLOW_WITHIN_MS = 1000;

test.use({ viewport: { width: 1440, height: 900 } }); // the editor's full layout

test.beforeEach(async ({ request }) => {
  const response = await request.put(`${SERVER_URL}/api/project`, { data: standProject() });
  expect(response.ok()).toBe(true);
});

test.afterAll(() => {
  expect(readFileSync(join(DEMO_DIR, 'project.json'), 'utf8')).toBe(demoOnDisk);
});

/** A two-page mini-site, zipped as a folder is zipped: everything inside one top folder. */
async function miniSite(): Promise<Buffer> {
  const zip = new yazl.ZipFile();
  zip.addBuffer(
    Buffer.from(
      '<!doctype html><title>Fair</title><h1>The fair</h1><a href="hall.html">Hall plan</a>',
    ),
    'fair/index.html',
  );
  zip.addBuffer(
    Buffer.from('<!doctype html><title>Hall</title><h1>Hall plan</h1>'),
    'fair/hall.html',
  );
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream as Readable) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

const shownPage = (player: Page) => player.locator('[data-layer="shown"]');

test('a mini-site set in the editor runs on the open player under its hotspots, until the web page time', async ({
  page,
}) => {
  const editor = page;
  const player = await page.context().newPage();
  await player.goto('/play/main');
  await expect(shownPage(player)).toHaveAttribute('data-page', 'p_home00');

  // The web page time, shortened to its minimum so the test does not wait three minutes.
  await editor.goto('/edit/settings');
  await expect(editor.getByRole('banner').getByText('Connected')).toBeVisible();
  await editor.getByRole('textbox', { name: 'Web page time' }).fill('10');

  // Product B's image is replaced by the uploaded mini-site.
  await editor.getByRole('banner').getByRole('link', { name: 'Pages' }).click();
  await editor.getByText('Product B', { exact: true }).click();
  const background = editor.getByRole('region', { name: 'Background' });
  await background.getByRole('button', { name: 'Remove' }).click();
  await background.getByRole('radio', { name: 'Web page' }).click();
  await editor.getByTestId('site-file').setInputFiles({
    name: 'Fair.zip',
    mimeType: 'application/zip',
    buffer: await miniSite(),
  });
  await expect(background.getByText('Mini-site')).toBeVisible();
  await expect(editor.getByRole('banner').getByText('Saved')).toBeVisible();

  // On the tablet: Product B now shows the site, under its hotspots.
  await shownPage(player).locator('[data-hotspot="h_cardb0"]').click();
  await expect(shownPage(player)).toHaveAttribute('data-page', 'p_prodb0', {
    timeout: FOLLOW_WITHIN_MS * 3,
  });
  const site = player.frameLocator('[data-layer="shown"] iframe');
  await expect(site.getByRole('heading', { name: 'The fair' })).toBeVisible();

  // A link inside the site works.
  await site.getByRole('link', { name: 'Hall plan' }).click();
  await expect(site.getByRole('heading', { name: 'Hall plan' })).toBeVisible();

  // A hotspot over the site still goes to another page.
  await shownPage(player).locator('[data-hotspot="h_bback0"]').click();
  await expect(shownPage(player)).toHaveAttribute('data-page', 'p_home00');

  // Back on the site, nobody touches it: after the web page time the tablet goes home.
  await shownPage(player).locator('[data-hotspot="h_cardb0"]').click();
  await expect(shownPage(player)).toHaveAttribute('data-page', 'p_prodb0');
  await expect(shownPage(player)).toHaveAttribute('data-page', 'p_home00', { timeout: 15_000 });
});

test("the demo stand's showroom is a mini-site page, reached from About us", async ({ page }) => {
  await page.goto('/play/main');
  await shownPage(page).locator('[data-hotspot="h_about0"]').click();
  await expect(shownPage(page)).toHaveAttribute('data-page', 'p_about0');
  await shownPage(page).locator('[data-hotspot="h_abtsr0"]').click();
  await expect(shownPage(page)).toHaveAttribute('data-page', 'p_shwrm0');
  const site = page.frameLocator('[data-layer="shown"] iframe');
  await expect(site.getByRole('heading', { name: 'The showroom' })).toBeVisible();
  await site.getByRole('link', { name: 'Compare all speakers' }).click();
  await expect(site.getByRole('heading', { name: 'Compare speakers' })).toBeVisible();
  await shownPage(page).locator('[data-hotspot="h_shbck0"]').click();
  await expect(shownPage(page)).toHaveAttribute('data-page', 'p_about0');
});
