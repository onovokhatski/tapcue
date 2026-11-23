import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Command, Project, Target } from '@tapcue/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app';
import { DEFAULT_PROJECT_DIR } from '../config';
import { loadProjectStore, type ProjectStore } from '../project/store';
import type { Drivers } from './dispatcher';
import type { SendContext } from './drivers/driver';

let store: ProjectStore;
beforeAll(async () => {
  store = await loadProjectStore(DEFAULT_PROJECT_DIR);
});

/** Drivers that record what they were asked to send; `fail` makes one throw. */
function fakeDrivers(fail?: string) {
  const sent: { target: Target; command: Command; context: SendContext }[] = [];
  const driver = {
    send: (target: Target, command: Command, context: SendContext) => {
      sent.push({ target, command, context });
      return fail ? Promise.reject(new Error(fail)) : Promise.resolve();
    },
    close: () => Promise.resolve(),
  };
  return { sent, drivers: { 'osc-udp': driver, udp: driver, http: driver } as unknown as Drivers };
}

function testSend(payload: unknown, fail?: string) {
  const fake = fakeDrivers(fail);
  const app = buildApp({ store, drivers: fake.drivers });
  const response = app.inject({
    method: 'POST',
    url: '/api/test-send',
    payload: payload as object,
  });
  return { response, sent: fake.sent };
}

describe('POST /api/test-send (spec ACT-4)', () => {
  it('sends the hotspot command through its driver, as a tap from the source "test"', async () => {
    const { response, sent } = testSend({ pageId: 'p_home00', hotspotId: 'h_carda0' });
    const answer = await response;
    expect(answer.statusCode).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      target: { id: 't_resolm', protocol: 'osc-udp' },
      command: { address: '/composition/columns/2/connect' },
      context: { source: { type: 'test' }, hotspotName: 'Product A card' },
    });
    expect(answer.json()).toMatchObject({
      entry: {
        status: 'sent',
        source: { type: 'test' },
        hotspotId: 'h_carda0',
        targetName: 'Resolume',
      },
    });
  });

  it('gives an HTTP command the "test" source, which its driver sends as X-Tapcue-Station: test (TGT-6)', async () => {
    const { response, sent } = testSend({ pageId: 'p_home00', hotspotId: 'h_call00' });
    expect((await response).statusCode).toBe(200);
    expect(sent[0]).toMatchObject({
      target: { protocol: 'http' },
      context: { source: { type: 'test' } },
    });
  });

  it('answers a delivery failure with the logged error, not a failed request', async () => {
    const answer = await testSend({ pageId: 'p_home00', hotspotId: 'h_carda0' }, 'host unreachable')
      .response;
    expect(answer.statusCode).toBe(200);
    expect(answer.json()).toMatchObject({
      entry: { status: 'error', message: 'host unreachable' },
    });
  });

  it.each([
    ['no body fields', {}],
    ['a page id that is not one', { pageId: 'home', hotspotId: 'h_carda0' }],
    ['a hotspot id that is not one', { pageId: 'p_home00', hotspotId: 42 }],
  ])('answers 400 for %s', async (_, payload) => {
    const { response, sent } = testSend(payload);
    const answer = await response;
    expect(answer.statusCode).toBe(400);
    expect(answer.json()).toEqual({ error: 'Expected { pageId, hotspotId }' });
    expect(sent).toHaveLength(0);
  });

  it('answers 404 for a hotspot that is not in the saved project', async () => {
    const { response, sent } = testSend({ pageId: 'p_home00', hotspotId: 'h_zzzzzz' });
    const answer = await response;
    expect(answer.statusCode).toBe(404);
    expect(answer.json()).toEqual({ error: 'The hotspot is not in the saved project' });
    expect(sent).toHaveLength(0);
  });

  it('answers 409 for a hotspot that sends no command', async () => {
    const { response, sent } = testSend({ pageId: 'p_home00', hotspotId: 'h_about0' });
    const answer = await response;
    expect(answer.statusCode).toBe(409);
    expect(answer.json()).toEqual({ error: 'The hotspot sends no command' });
    expect(sent).toHaveLength(0);
  });
});

describe('POST /api/test-send for a fader (spec FD-2, ADR 0020)', () => {
  let dir: string;
  let faderStore: ProjectStore;

  // A copy of the demo stand whose "Call our team" is a fader sending OSC to Resolume.
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tapcue-fader-'));
    await cp(DEFAULT_PROJECT_DIR, dir, { recursive: true });
    const file = join(dir, 'project.json');
    const project = JSON.parse(await readFile(file, 'utf8')) as Project;
    const call = project.pages[0]!.hotspots.find((h) => h.id === 'h_call00')!;
    call.kind = 'fader';
    call.fader = {
      orientation: 'horizontal',
      min: 0,
      max: 1,
      step: 0.01,
      start: 0.5,
      value: { at: 0, as: 'f' },
    };
    call.pressEffect = 'none';
    call.action = {
      goTo: null,
      commands: [
        {
          command: { type: 'osc-udp', targetId: 't_resolm', address: '/layer/1/opacity', args: [] },
        },
      ],
    };
    await writeFile(file, JSON.stringify(project));
    faderStore = await loadProjectStore(dir);
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  function send(payload: object) {
    const fake = fakeDrivers();
    const app = buildApp({ store: faderStore, drivers: fake.drivers });
    return { response: app.inject({ method: 'POST', url: '/api/test-send', payload }), ...fake };
  }

  it('sends the fader command with the chosen value, snapped, from the source "test"', async () => {
    const { response, sent } = send({ pageId: 'p_home00', hotspotId: 'h_call00', value: 0.333 });
    const answer = await response;
    expect(answer.statusCode).toBe(200);
    expect(sent.map((s) => s.command)).toEqual([
      {
        type: 'osc-udp',
        targetId: 't_resolm',
        address: '/layer/1/opacity',
        args: [{ type: 'f', value: 0.33 }],
      },
    ]);
    expect(answer.json()).toMatchObject({ entry: { status: 'sent', source: { type: 'test' } } });
  });

  it('answers 400 without a value', async () => {
    const { response, sent } = send({ pageId: 'p_home00', hotspotId: 'h_call00' });
    const answer = await response;
    expect(answer.statusCode).toBe(400);
    expect(answer.json()).toEqual({ error: 'Expected a value to send for a fader' });
    expect(sent).toEqual([]);
  });

  it('answers a value outside the range with the ignored entry and its reason', async () => {
    const { response, sent } = send({ pageId: 'p_home00', hotspotId: 'h_call00', value: 2 });
    expect((await response).json()).toMatchObject({
      entry: { status: 'ignored', message: `Value 2 is outside "Call our team"'s range, 0 to 1` },
    });
    expect(sent).toEqual([]);
  });
});

describe('POST /api/test-send for a sequence (spec ACT-4, ADR 0022)', () => {
  let dir: string;
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /** A copy of the demo stand where Product A's card sends these steps. */
  async function sequenceApp(steps: { delayMs?: number; command: Command }[]) {
    dir = await mkdtemp(join(tmpdir(), 'tapcue-sequence-'));
    await cp(DEFAULT_PROJECT_DIR, dir, { recursive: true });
    const file = join(dir, 'project.json');
    const project = JSON.parse(await readFile(file, 'utf8')) as Project;
    project.pages[0]!.hotspots.find((h) => h.id === 'h_carda0')!.action.commands = steps;
    await writeFile(file, JSON.stringify(project));
    const fake = fakeDrivers();
    const app = buildApp({ store: await loadProjectStore(dir), drivers: fake.drivers });
    const send = () =>
      app.inject({
        method: 'POST',
        url: '/api/test-send',
        payload: { pageId: 'p_home00', hotspotId: 'h_carda0' },
      });
    return { app, send, sent: fake.sent };
  }
  const udp = (text: string): Command => ({ type: 'udp', targetId: 't_projec', text });

  it('runs the whole sequence: answers the first step, sends the rest after their delays', async () => {
    const { app, send, sent } = await sequenceApp([
      { command: udp('ONE') },
      { delayMs: 30, command: udp('TWO') },
    ]);

    const answer = await send();

    expect(answer.json()).toMatchObject({
      entry: { status: 'sent', sequence: { step: 1, of: 2 }, source: { type: 'test' } },
    });
    await vi.waitFor(() =>
      expect(sent.map((s) => 'text' in s.command && s.command.text)).toEqual(['ONE', 'TWO']),
    );
    expect(sent[1]!.context.source).toEqual({ type: 'test' });
    await app.close();
  });

  it('sends nothing more once the server stops', async () => {
    const { app, send, sent } = await sequenceApp([
      { command: udp('ONE') },
      { delayMs: 30, command: udp('TWO') },
    ]);
    await send();

    await app.close();
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(sent).toHaveLength(1);
  });

  it('answers a null entry when the first step waits for its delay', async () => {
    const { app, send, sent } = await sequenceApp([{ delayMs: 30, command: udp('LATE') }]);

    const answer = await send();

    expect(answer.statusCode).toBe(200);
    expect(answer.json()).toEqual({ entry: null });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await app.close();
  });
});
