// A tap's sequence of commands reaches the demo receiver in order and with its delay, and a new
// tap starts it over (spec ACT-5 to ACT-7, ADR 0022). The stand is put back after each test.
import type { Command, Project } from '@tapcue/shared';
import { expect, test } from '@playwright/test';
import { SERVER_URL, standProject } from './stand';

const DELAY_MS = 1200;

/** The stand with "Call our team" sending two requests to the demo receiver, the second later. */
function withSequence(): Project {
  const project = standProject();
  const call = project.pages
    .find((p) => p.id === 'p_home00')!
    .hotspots.find((h) => h.id === 'h_call00')!;
  const first = call.action.commands[0]!.command;
  const second: Command = { ...first, path: '/demo/screen-1/second-step' } as Command;
  call.action.commands = [{ command: first }, { delayMs: DELAY_MS, command: second }];
  return project;
}

test.beforeEach(async ({ request }) => {
  expect((await request.put(`${SERVER_URL}/api/project`, { data: withSequence() })).ok()).toBe(
    true,
  );
});

test.afterEach(async ({ request }) => {
  expect((await request.put(`${SERVER_URL}/api/project`, { data: standProject() })).ok()).toBe(
    true,
  );
});

test('a tap sends its sequence to the demo receiver in order, with the delay between', async ({
  context,
}) => {
  const demo = await context.newPage();
  await demo.goto('/demo');
  await expect(demo.getByRole('status')).toHaveText('Waiting for the first command');
  const player = await context.newPage();
  await player.goto('/play/main');

  await player.locator('[data-hotspot="h_call00"]').click();
  await expect(demo.getByRole('region', { name: 'screen-3' })).toContainText('call-staff');
  const first = Date.now();
  await expect(demo.getByRole('region', { name: 'screen-1' })).toContainText('second-step', {
    timeout: DELAY_MS + 2000,
  });

  // At least the delay, less a margin for the time the first one took to show up.
  expect(Date.now() - first).toBeGreaterThanOrEqual(DELAY_MS - 300);
  await expect(demo.getByRole('status')).toHaveText('Receiving · 2 requests');
});

test('a new tap during the delay starts the sequence over', async ({ context }) => {
  const demo = await context.newPage();
  await demo.goto('/demo');
  await expect(demo.getByRole('status')).toHaveText('Waiting for the first command');
  const player = await context.newPage();
  await player.goto('/play/main');

  await player.locator('[data-hotspot="h_call00"]').click();
  await expect(demo.getByRole('status')).toHaveText('Receiving · 1 request');
  await player.locator('[data-hotspot="h_call00"]').click();

  // The first tap's second step was cancelled: two first steps, then one second step.
  await expect(demo.getByRole('status')).toHaveText('Receiving · 3 requests', {
    timeout: DELAY_MS + 2000,
  });
  await demo.waitForTimeout(DELAY_MS + 300);
  await expect(demo.getByRole('status')).toHaveText('Receiving · 3 requests');
});
