// The M3 "done when": a change in the editor reaches an open player within a second, and a player
// on a deleted page goes back to the start page (spec PLY-5, PLY-6, ED-5, roadmap M3).
// Every test starts from the demo project, put back through the API.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
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

/** A player on station "main" and an editor, both loaded and connected. */
async function playerAndEditor(page: Page) {
  const player = await page.context().newPage();
  await player.goto('/play/main');
  await expect(player.locator('[data-layer="shown"]')).toHaveAttribute('data-page', 'p_home00');

  const editor = page;
  await editor.goto('/edit/pages');
  await expect(editor.getByRole('banner').getByText('Connected')).toBeVisible();
  await expect(editor.getByRole('banner').getByText('Saved')).toBeVisible();
  return { player, editor };
}

const shownHotspots = (player: Page) => player.locator('[data-layer="shown"] [data-hotspot]');

test('a hotspot added in the editor appears on the open player within a second', async ({
  page,
}) => {
  const { player, editor } = await playerAndEditor(page);
  await expect(shownHotspots(player)).toHaveCount(5);

  await editor.getByRole('button', { name: 'Add hotspot' }).click();

  await expect(shownHotspots(player)).toHaveCount(6, { timeout: FOLLOW_WITHIN_MS });
  await expect(editor.getByRole('banner').getByText('Saved')).toBeVisible();
});

test('a hotspot moved in the editor moves on the open player within a second', async ({ page }) => {
  const { player, editor } = await playerAndEditor(page);
  const card = player.locator('[data-layer="shown"] [data-hotspot="h_carda0"]');
  await expect(card).toHaveCSS('left', '144px');

  await editor
    .getByRole('region', { name: 'Canvas' })
    .getByRole('button', { name: 'Product A card' })
    .click();
  const x = editor.getByRole('textbox', { name: 'X', exact: true });
  await x.fill('300');

  await expect(card).toHaveCSS('left', '300px', { timeout: FOLLOW_WITHIN_MS });
  // The player kept its page: it followed the change, it did not reload.
  await expect(player.locator('[data-layer="shown"]')).toHaveAttribute('data-page', 'p_home00');
});

test('a player on a page deleted in the editor goes back to the start page', async ({ page }) => {
  const { player, editor } = await playerAndEditor(page);
  await player.locator('[data-layer="shown"] [data-hotspot="h_carda0"]').click();
  await expect(player.locator('[data-layer="shown"]')).toHaveAttribute('data-page', 'p_proda0');

  await editor.getByRole('button', { name: 'Delete page Product A' }).click();
  await editor.getByRole('alertdialog').getByRole('button', { name: 'Delete page' }).click();

  await expect(player.locator('[data-layer="shown"]')).toHaveAttribute('data-page', 'p_home00', {
    timeout: FOLLOW_WITHIN_MS,
  });
});
