// The v0.10 "done when": a page transition chosen in the editor is used on an open player, Slide
// in the direction of the page order, and a station invites taps after its quiet time and stops
// on a touch (spec PG-4, ST-7, ADR 0025). Every test starts from the demo project, which slides
// and invites on its main station, put back through the API.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { DEMO_DIR, SERVER_URL, standProject } from './stand';

/** The demo project as it is in git; the tests must leave it so. */
const demoOnDisk = readFileSync(join(DEMO_DIR, 'project.json'), 'utf8');

test.use({ viewport: { width: 1440, height: 900 } }); // the editor's full layout

test.beforeEach(async ({ request }) => {
  const response = await request.put(`${SERVER_URL}/api/project`, { data: standProject() });
  expect(response.ok()).toBe(true);
});

test.afterAll(() => {
  expect(readFileSync(join(DEMO_DIR, 'project.json'), 'utf8')).toBe(demoOnDisk);
});

const shownPage = (player: Page) => player.locator('[data-layer="shown"]');

/**
 * Records how each incoming page comes in: its motion and the animation the browser runs for it.
 * A transition lasts a third of a second, too short to catch by polling, so the page notes it.
 */
async function recordTransitions(player: Page) {
  await player.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { transitions: string[] }).transitions = seen;
    new MutationObserver(() => {
      const layer = document.querySelector<HTMLElement>('[data-layer="incoming"][data-fading]');
      if (!layer) return;
      const entry = `${layer.dataset['motion']} ${getComputedStyle(layer).animationName}`;
      if (seen.at(-1) !== entry) seen.push(entry);
    }).observe(document.body, { subtree: true, attributes: true, childList: true });
  });
}

const transitions = (player: Page) =>
  player.evaluate(() => (window as unknown as { transitions: string[] }).transitions.splice(0));

/**
 * Waits for the editor to save and the player to take the change. A transition shows nothing on
 * the player until the next page change, so this waits out the second within which every open
 * player follows a saved change (spec PLY-5), as edit-to-player.spec.ts checks.
 */
async function followed(editor: Page, player: Page) {
  await expect(editor.getByRole('banner').getByText('Saved')).toBeVisible();
  await player.waitForTimeout(1000);
}

/** Taps a hotspot on the player and waits until its page is fully on screen. */
async function goTo(player: Page, hotspotId: string, pageId: string) {
  await shownPage(player).locator(`[data-hotspot="${hotspotId}"]`).click();
  await expect(shownPage(player)).toHaveAttribute('data-page', pageId);
  await expect(player.locator('[data-layer="incoming"]')).toHaveCount(0);
}

test('a transition chosen in Settings is used on the open player, Slide in page order', async ({
  page,
}) => {
  const player = await page.context().newPage();
  await player.goto('/play/main');
  await expect(shownPage(player)).toHaveAttribute('data-page', 'p_home00');
  await recordTransitions(player);

  const editor = page;
  await editor.goto('/edit/settings');
  const transition = editor.getByRole('radiogroup', { name: 'Page transition' });
  await expect(transition.getByRole('radio', { name: 'Slide' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Zoom, chosen in the editor, reaches the player.
  await transition.getByRole('radio', { name: 'Zoom' }).click();
  await followed(editor, player);
  await goTo(player, 'h_carda0', 'p_proda0');
  expect(await transitions(player)).toEqual(['zoom page-zoom-in']);

  // Slide again: back up the list comes in from the left, down the list from the right.
  await transition.getByRole('radio', { name: 'Slide' }).click();
  await followed(editor, player);
  await goTo(player, 'h_aback0', 'p_home00'); // Product A (2nd) → Home (1st)
  await goTo(player, 'h_carda0', 'p_proda0'); // Home (1st) → Product A (2nd)
  expect(await transitions(player)).toEqual([
    'slide-from-left page-slide-from-left',
    'slide-from-right page-slide-from-right',
  ]);
});

test('the main station invites taps after 15 s on its start page, and a touch stops it', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/play/main');
  await expect(shownPage(page)).toHaveAttribute('data-page', 'p_home00');
  const pulsing = page.locator('[data-layer="shown"] [data-inviting]');

  await page.clock.fastForward(14_000);
  await expect(pulsing).toHaveCount(0);
  await page.clock.fastForward(1_000);
  await expect(pulsing).toHaveAttribute('data-hotspot', 'h_carda0');
  // The end of each pulse, run by the browser's own clock, hands the turn to the next button.
  await expect(pulsing).toHaveAttribute('data-hotspot', 'h_cardb0', { timeout: 5000 });

  // A touch outside any hotspot stops it at once, and the page stays.
  await page.mouse.click(40, 450);
  await expect(pulsing).toHaveCount(0);
  await expect(shownPage(page)).toHaveAttribute('data-page', 'p_home00');
});
