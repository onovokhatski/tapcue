// The whole M2 flow: a tap in the player → WebSocket → dispatcher → HTTP driver → demo receiver
// → WebSocket → the demo page (spec DEMO-2, roadmap M2).
import { expect, test } from '@playwright/test';

test('a tap in the player appears on the demo receiver page', async ({ context }) => {
  const demo = await context.newPage();
  await demo.goto('/demo');
  // Shown only once the page is connected and has received nothing yet.
  await expect(demo.getByRole('status')).toHaveText('Waiting for the first command');

  const player = await context.newPage();
  await player.goto('/play/main');
  // "Call our team" on Home sends POST /demo/screen-3/call-staff to the demo receiver.
  await player.locator('[data-hotspot="h_call00"]').click();

  const tile = demo.getByRole('region', { name: 'screen-3' });
  await expect(tile).toContainText('call-staff');
  await expect(tile).toContainText('Main catalog · Call our team');
  await expect(demo.getByRole('row').nth(1)).toContainText('/demo/screen-3/call-staff');
});

test('a tap that only navigates sends nothing to the demo receiver', async ({ context }) => {
  const demo = await context.newPage();
  await demo.goto('/demo');
  await expect(demo.getByRole('status')).toHaveText('Waiting for the first command');

  const player = await context.newPage();
  await player.goto('/play/main');
  await player.locator('[data-hotspot="h_about0"]').click(); // About: navigation only
  await expect(player.locator('[data-layer="shown"]')).toHaveAttribute('data-page', 'p_about0');

  // The next tap with a command arrives alone: nothing came before it.
  await player.locator('[data-hotspot="h_abtbk0"]').click(); // Back to Home, navigation only
  await expect(player.locator('[data-layer="shown"]')).toHaveAttribute('data-page', 'p_home00');
  await player.locator('[data-hotspot="h_call00"]').click();
  await expect(demo.getByRole('status')).toHaveText('Receiving · 1 request');
});
