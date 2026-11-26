// Opening another project from the library switches every open player and editor to it within a
// second (spec PRJ-7, ADR 0021). The test puts the stand back, so the other tests find it open.
import { expect, test } from '@playwright/test';
import { SERVER_URL, STAND_ID, standProject } from './stand';

const FOLLOW_WITHIN_MS = 1000;

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ request }) => {
  const response = await request.put(`${SERVER_URL}/api/project`, { data: standProject() });
  expect(response.ok()).toBe(true);
});

test.afterEach(async ({ request }) => {
  expect((await request.post(`${SERVER_URL}/api/projects/${STAND_ID}/open`)).ok()).toBe(true);
  for (const id of ['hall-b', 'old-hall']) await request.delete(`${SERVER_URL}/api/projects/${id}`);
});

test('a project opened from the library reaches the open player and editor within a second', async ({
  page,
  request,
}) => {
  const player = await page.context().newPage();
  await player.goto('/play/main');
  await expect(player.locator('[data-layer="shown"]')).toHaveAttribute('data-page', 'p_home00');
  const editor = page;
  await editor.goto('/edit/pages');
  await expect(editor.getByRole('banner').getByText('Demo stand')).toBeVisible();
  await expect(editor.getByRole('banner').getByText('Connected')).toBeVisible();

  const created = await request.post(`${SERVER_URL}/api/projects`, {
    data: { name: 'Hall B', width: 1024, height: 768 },
  });
  expect(created.status()).toBe(201);
  expect(await created.json()).toEqual({ id: 'hall-b' });
  expect((await request.post(`${SERVER_URL}/api/projects/hall-b/open`)).ok()).toBe(true);
  const { project } = (await (await request.get(`${SERVER_URL}/api/project`)).json()) as {
    project: { pages: { id: string }[] };
  };

  // The new project's one blank page, on station "main", which every new project has (PRJ-6).
  await expect(player.locator('[data-layer="shown"]')).toHaveAttribute(
    'data-page',
    project.pages[0]!.id,
    { timeout: FOLLOW_WITHIN_MS },
  );
  await expect(player.locator('[data-layer="shown"] [data-hotspot]')).toHaveCount(0);
  await expect(editor.getByRole('banner').getByText('Hall B')).toBeVisible({
    timeout: FOLLOW_WITHIN_MS,
  });
});

test('a project created on the Projects tab opens on the player, and another one is deleted', async ({
  page,
  request,
}) => {
  // A second stand to delete, so the one the other tests use is never touched.
  expect(
    (
      await request.post(`${SERVER_URL}/api/projects`, {
        data: { name: 'Old hall', width: 800, height: 600 },
      })
    ).status(),
  ).toBe(201);
  const player = await page.context().newPage();
  await player.goto('/play/main');
  await expect(player.locator('[data-layer="shown"]')).toHaveAttribute('data-page', 'p_home00');

  const editor = page;
  await editor.goto('/edit/pages');
  await editor.getByRole('banner').getByRole('link', { name: 'Demo stand' }).click();
  await editor.getByRole('button', { name: 'New project' }).click();
  const dialog = editor.getByRole('dialog', { name: 'New project' });
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Hall B');
  await dialog.getByRole('combobox', { name: 'Canvas size' }).selectOption('1920x1080');
  await dialog.getByRole('button', { name: 'Create and open' }).click();

  await expect(editor).toHaveURL(/\/edit\/pages$/);
  await expect(editor.getByRole('banner').getByRole('link', { name: 'Hall B' })).toBeVisible();
  await expect(player.locator('[data-layer="shown"] [data-hotspot]')).toHaveCount(0, {
    timeout: FOLLOW_WITHIN_MS,
  });
  await expect(player.locator('[data-layer="shown"]')).not.toHaveAttribute('data-page', 'p_home00');

  await editor.getByRole('link', { name: 'Projects' }).click();
  await editor.getByRole('button', { name: 'Delete Old hall' }).click();
  await editor.getByRole('alertdialog').getByRole('button', { name: 'Delete project' }).click();
  await expect(editor.getByRole('group', { name: 'Old hall' })).toHaveCount(0);
  await expect(editor.getByRole('group', { name: 'Hall B' })).toContainText('1920 × 1080');
});
