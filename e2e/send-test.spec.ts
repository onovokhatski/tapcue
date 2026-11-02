// The M4 "done when", part one: "Send test" in the editor goes editor → server → HTTP driver →
// demo receiver → the demo page, as a tap would, from the source "test" (spec ACT-4, roadmap M4).
import { expect, test } from '@playwright/test';
import { SERVER_URL, standProject } from './stand';

test.use({ viewport: { width: 1440, height: 900 } }); // the editor's full layout

test.beforeEach(async ({ request }) => {
  const response = await request.put(`${SERVER_URL}/api/project`, { data: standProject() });
  expect(response.ok()).toBe(true);
});

test('Send test in the editor reaches the demo receiver from the source "test"', async ({
  context,
}) => {
  const demo = await context.newPage();
  await demo.goto('/demo');
  await expect(demo.getByRole('status')).toHaveText('Waiting for the first command');

  const editor = await context.newPage();
  await editor.goto('/edit/pages');
  await expect(editor.getByRole('banner').getByText('Connected')).toBeVisible();
  // "Call our team" on Home sends POST /demo/screen-3/call-staff to the demo receiver.
  await editor
    .getByRole('region', { name: 'Canvas' })
    .getByRole('button', { name: 'Call our team' })
    .click();
  await editor.getByRole('button', { name: 'Send test' }).click();

  await expect(editor.getByRole('status').filter({ hasText: 'Sent at' })).toBeVisible();
  const tile = demo.getByRole('region', { name: 'screen-3' });
  await expect(tile).toContainText('call-staff');
  // No station sent it: the HTTP driver names the source "test".
  await expect(tile).toContainText('test · Call our team');
  await expect(demo.getByRole('row').nth(1)).toContainText('/demo/screen-3/call-staff');
});
