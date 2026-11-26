// A sequence built in the editor runs from the player: both requests reach the demo receiver with
// the pause between them, and the editor's command log gathers them into one row (spec ACT-5,
// ACT-6, TGT-4, ADR 0022). The stand is put back after the test.
import { expect, test } from '@playwright/test';
import { SERVER_URL, standProject } from './stand';

test.use({ viewport: { width: 1440, height: 1000 } }); // the editor's full layout, with the log

test.beforeEach(async ({ request }) => {
  expect((await request.put(`${SERVER_URL}/api/project`, { data: standProject() })).ok()).toBe(
    true,
  );
});

test.afterEach(async ({ request }) => {
  expect((await request.put(`${SERVER_URL}/api/project`, { data: standProject() })).ok()).toBe(
    true,
  );
});

test('a sequence built in the editor reaches the demo receiver in order, with its pause', async ({
  page,
}) => {
  const editor = page;
  await editor.goto('/edit/pages');
  await expect(editor.getByRole('banner').getByText('Connected')).toBeVisible();
  await editor
    .getByRole('region', { name: 'Canvas' })
    .getByRole('button', { name: 'Call our team' })
    .click();

  const onTap = editor.getByRole('region', { name: 'On tap' });
  await onTap.getByRole('button', { name: 'Add command' }).click();
  const second = onTap.getByRole('group', { name: 'Command 2' });
  await second.getByRole('textbox', { name: 'Wait before command 2' }).fill('1.2');
  await second.getByRole('textbox', { name: 'Path' }).fill('/demo/lights/call');
  await expect(onTap.getByText('2 commands over 1.2 s')).toBeVisible();
  await expect(editor.getByRole('banner').getByText('Saved')).toBeVisible();

  const demo = await page.context().newPage();
  await demo.goto('/demo');
  await expect(demo.getByRole('status')).toHaveText('Waiting for the first command');
  const player = await page.context().newPage();
  await player.goto('/play/main');
  await player.locator('[data-hotspot="h_call00"]').click();

  await expect(demo.getByRole('region', { name: 'screen-3' })).toContainText('call-staff');
  await expect(demo.getByRole('region', { name: 'lights' })).toContainText('call', {
    timeout: 4000,
  });
  const rows = demo.getByRole('table').getByRole('row');
  await expect(rows.nth(1)).toContainText(/Call our team · step 2 of 2 · \+1\.\d s/);
  await expect(rows.nth(2)).toContainText('Call our team · step 1 of 2');

  const log = editor.getByRole('region', { name: 'Command log' });
  const sequence = log.getByRole('button', { name: 'Sequence of 2 commands' });
  await expect(log).toContainText('2 of 2 sent');
  await sequence.click();
  await expect(log).toContainText('Step 2 of 2 · after 1.2 s');
});

test('a page link added as a card in the editor changes the page on the open player (spec ED-22)', async ({
  page,
}) => {
  const editor = page;
  await editor.goto('/edit/pages');
  await expect(editor.getByRole('banner').getByText('Connected')).toBeVisible();
  await editor
    .getByRole('region', { name: 'Canvas' })
    .getByRole('button', { name: 'Call our team' })
    .click();

  const onTap = editor.getByRole('region', { name: 'On tap' });
  await onTap.getByRole('button', { name: 'Go to page' }).click();
  const card = onTap.getByRole('group', { name: 'Go to page' });
  await card.getByRole('combobox', { name: 'Page to go to' }).selectOption({ label: 'About us' });
  await expect(editor.getByRole('banner').getByText('Saved')).toBeVisible();

  const player = await page.context().newPage();
  await player.goto('/play/main');
  await expect(player.locator('[data-layer="shown"]')).toHaveAttribute('data-page', 'p_home00');
  await player.locator('[data-layer="shown"] [data-hotspot="h_call00"]').click();
  // The page changes, and the command still goes out.
  await expect(player.locator('[data-layer="shown"]')).toHaveAttribute('data-page', 'p_about0');
});
