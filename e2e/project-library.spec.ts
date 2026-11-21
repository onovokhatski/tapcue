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
  await request.delete(`${SERVER_URL}/api/projects/hall-b`);
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
