// The M4 "done when", part two: a project exported from the editor, then changed, then imported
// again from the export, runs in an open player as it was exported (spec PRJ-3, PRJ-4, roadmap M4).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
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

test('an exported project, imported again after a change, runs in the player as exported', async ({
  context,
  request,
}) => {
  const player = await context.newPage();
  await player.goto('/play/main');
  const shownHotspots = player.locator('[data-layer="shown"] [data-hotspot]');
  await expect(shownHotspots).toHaveCount(5);

  const editor = await context.newPage();
  await editor.goto('/edit/settings');
  await expect(editor.getByRole('banner').getByText('Connected')).toBeVisible();

  // Export: the browser downloads the server's file.
  const downloading = editor.waitForEvent('download');
  await editor.getByRole('link', { name: 'Export .zip' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('demo-stand.zip');
  const exported = await download.path();

  // A change after the export: renamed, and Home without its "About" hotspot.
  const changed = standProject();
  changed.name = 'Changed stand';
  changed.pages[0]!.hotspots = changed.pages[0]!.hotspots.filter((h) => h.name !== 'About');
  expect((await request.put(`${SERVER_URL}/api/project`, { data: changed })).ok()).toBe(true);
  await expect(shownHotspots).toHaveCount(4);
  await expect(editor.getByRole('banner').getByText('Changed stand')).toBeVisible();

  // Import the export: the dialog says what the file holds and what it replaces.
  await editor.getByTestId('import-file').setInputFiles(exported);
  const dialog = editor.getByRole('dialog', { name: 'Replace the current project?' });
  await expect(dialog).toContainText(
    'has 4 pages, 3 targets and 2 stations. Everything in “Changed stand” will be replaced',
  );
  await dialog.getByRole('button', { name: 'Replace project' }).click();

  await expect(editor.getByRole('status').filter({ hasText: 'Imported' })).toBeVisible();
  await expect(editor.getByRole('banner').getByText('Demo stand')).toBeVisible();
  // The open player follows the import, as it follows a save.
  await expect(shownHotspots).toHaveCount(5);
  await expect(player.locator('[data-layer="shown"] [data-hotspot="h_about0"]')).toBeVisible();
});
