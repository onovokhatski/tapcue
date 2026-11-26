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

test('a move undone in the editor goes back on the open player, and redo moves it again (spec ED-24, ED-26)', async ({
  page,
}) => {
  const { player, editor } = await playerAndEditor(page);
  const card = player.locator('[data-layer="shown"] [data-hotspot="h_carda0"]');
  await expect(card).toHaveCSS('left', '144px');

  await editor
    .getByRole('region', { name: 'Canvas' })
    .getByRole('button', { name: 'Product A card' })
    .click();
  await editor.keyboard.press('Shift+ArrowRight');
  await expect(card).toHaveCSS('left', '154px', { timeout: FOLLOW_WITHIN_MS });

  await editor.keyboard.press('ControlOrMeta+z');
  await expect(card).toHaveCSS('left', '144px', { timeout: FOLLOW_WITHIN_MS });

  await editor.getByRole('banner').getByRole('button', { name: 'Redo' }).click();
  await expect(card).toHaveCSS('left', '154px', { timeout: FOLLOW_WITHIN_MS });
  await expect(editor.getByRole('banner').getByRole('button', { name: 'Redo' })).toBeDisabled();
});

test('three hotspots selected on the canvas move together on the open player (spec ED-16)', async ({
  page,
}) => {
  const { player, editor } = await playerAndEditor(page);
  const cardOnPlayer = (id: string) =>
    player.locator(`[data-layer="shown"] [data-hotspot="${id}"]`);
  await expect(cardOnPlayer('h_carda0')).toHaveCSS('top', '500px');

  const canvas = editor.getByRole('region', { name: 'Canvas' });
  const outline = (name: string) => canvas.getByRole('button', { name, exact: true });
  await outline('Product A card').click();
  await outline('Product B card').click({ modifiers: ['Shift'] });
  await outline('Product C card').click({ modifiers: ['Shift'] });
  await expect(editor.getByRole('heading', { name: '3 hotspots' })).toBeVisible();

  // Drag card B up by 100 screen pixels: the three move together, by the same canvas distance.
  const box = (await outline('Product B card').boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await editor.mouse.move(start.x, start.y);
  await editor.mouse.down();
  await editor.mouse.move(start.x, start.y - 50, { steps: 5 });
  await editor.mouse.move(start.x, start.y - 100, { steps: 5 });
  await editor.mouse.up();

  const moved = await editor.getByRole('textbox', { name: 'Group Y' }).inputValue();
  expect(Number(moved)).toBeLessThan(500);
  for (const id of ['h_carda0', 'h_cardb0', 'h_cardc0']) {
    await expect(cardOnPlayer(id)).toHaveCSS('top', `${moved}px`, { timeout: FOLLOW_WITHIN_MS });
  }
  // The others stay where they were.
  await expect(cardOnPlayer('h_about0')).toHaveCSS('top', '1244px');
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
