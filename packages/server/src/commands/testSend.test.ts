import type { Command, Target } from '@tapcue/shared';
import { beforeAll, describe, expect, it } from 'vitest';
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
