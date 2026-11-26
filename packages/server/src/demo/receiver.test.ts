import { DemoRequest } from '@tapcue/shared';
import Fastify, { type InjectOptions } from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerDemoReceiver } from './receiver';

const NOW = new Date('2026-10-30T14:05:09.123Z');

async function receive(request: InjectOptions) {
  const app = Fastify();
  const received: DemoRequest[] = [];
  registerDemoReceiver(app, { onRequest: (r) => received.push(r), now: () => NOW });
  const response = await app.inject(request);
  await app.close();
  return { response, received };
}

describe('demo receiver endpoint (spec DEMO-1)', () => {
  it('reports a POST with its screen, content and body, and answers 200', async () => {
    const { response, received } = await receive({
      method: 'POST',
      url: '/demo/screen-3/call-staff',
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
        'x-tapcue-station': 'main',
        'x-tapcue-hotspot': 'Call our team',
      },
      payload: '{ "stand": "B12" }',
    });
    expect(response.statusCode).toBe(200);
    expect(received).toEqual([
      {
        time: '2026-10-30T14:05:09.123Z',
        method: 'POST',
        path: '/demo/screen-3/call-staff',
        screen: 'screen-3',
        content: 'call-staff',
        body: '{ "stand": "B12" }',
        station: 'main',
        hotspot: 'Call our team',
      },
    ]);
    expect(DemoRequest.safeParse(received[0]).success).toBe(true);
  });

  it('reports a request without a body or Tapcue headers with nulls', async () => {
    const { received } = await receive({ method: 'POST', url: '/demo/screen-1/product-a' });
    expect(received).toMatchObject([
      { screen: 'screen-1', content: 'product-a', body: null, station: null, hotspot: null },
    ]);
  });

  it('decodes a percent-encoded hotspot name, and keeps one that is not', async () => {
    const send = (hotspot: string) =>
      receive({
        method: 'POST',
        url: '/demo/screen-1/product-a',
        headers: { 'x-tapcue-hotspot': hotspot },
      });
    expect((await send('%D0%9A%D0%BD%D0%BE%D0%BF%D0%BA%D0%B0 100%25')).received).toMatchObject([
      { hotspot: 'Кнопка 100%' },
    ]);
    expect((await send('50% off')).received).toMatchObject([{ hotspot: '50% off' }]);
  });

  it("reports a fader's level from X-Tapcue-Fader (spec TGT-6, ADR 0020)", async () => {
    const { received } = await receive({
      method: 'PUT',
      url: '/demo/screen-1/volume',
      headers: { 'x-tapcue-fader': '42 0 100' },
      payload: '42',
    });
    expect(received[0]).toMatchObject({
      content: 'volume',
      fader: { value: 42, min: 0, max: 100 },
    });
    expect(DemoRequest.safeParse(received[0]).error).toBeUndefined();
  });

  it("reports a sequence's step from X-Tapcue-Sequence (spec TGT-6, ADR 0022)", async () => {
    const { received } = await receive({
      method: 'POST',
      url: '/demo/lights/product-a',
      headers: { 'x-tapcue-sequence': '17 2 3' },
    });
    expect(received[0]).toMatchObject({ sequence: { run: 17, step: 2, of: 3 } });
    expect(DemoRequest.safeParse(received[0]).error).toBeUndefined();
  });

  it.each([
    ['17 2'],
    ['17 2 3 4'],
    ['a 2 3'],
    ['17 0 3'],
    ['17 4 3'],
    ['-1 1 3'],
    ['17 1.5 3'],
    [''],
  ])('reports no sequence for a malformed header "%s"', async (header) => {
    const { received } = await receive({
      method: 'POST',
      url: '/demo/lights/product-a',
      headers: { 'x-tapcue-sequence': header },
    });
    expect(received[0]).not.toHaveProperty('sequence');
  });

  it.each([['0.5'], ['half 0 1'], ['0.5 1 0'], ['0.5 0 1 2'], ['']])(
    'reports no fader for a malformed header "%s"',
    async (header) => {
      const { received } = await receive({
        method: 'PUT',
        url: '/demo/screen-1/volume',
        headers: { 'x-tapcue-fader': header },
      });
      expect(received[0]).not.toHaveProperty('fader');
    },
  );

  it('reports an empty body as null too', async () => {
    const { received } = await receive({
      method: 'POST',
      url: '/demo/screen-1/product-a',
      headers: { 'content-type': 'text/plain' },
      payload: '',
    });
    expect(received).toMatchObject([{ body: null }]);
  });

  it('accepts any method, e.g. GET and PUT', async () => {
    for (const method of ['GET', 'PUT'] as const) {
      const { response, received } = await receive({ method, url: '/demo/screen-1/product-b' });
      expect(response.statusCode).toBe(200);
      expect(received).toMatchObject([{ method }]);
    }
  });

  it('keeps a JSON body as sent, even an invalid one', async () => {
    const { response, received } = await receive({
      method: 'POST',
      url: '/demo/screen-1/product-a',
      headers: { 'content-type': 'application/json' },
      payload: '{ not json',
    });
    expect(response.statusCode).toBe(200);
    expect(received).toMatchObject([{ body: '{ not json' }]);
  });

  it('decodes the path segments and leaves the query out of the path', async () => {
    const { received } = await receive({ method: 'POST', url: '/demo/screen%201/caf%C3%A9?x=1' });
    expect(received).toMatchObject([
      { path: '/demo/screen%201/caf%C3%A9', screen: 'screen 1', content: 'café' },
    ]);
  });

  it.each(['/demo/screen-1', '/demo/screen-1/product-a/extra', '/demo/'])(
    'rejects %s with a hint and reports nothing',
    async (url) => {
      const { response, received } = await receive({ method: 'POST', url });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'Expected /demo/<screen>/<content>, e.g. /demo/screen-1/product-a',
      });
      expect(received).toEqual([]);
    },
  );

  it('leaves /demo itself to the web app', async () => {
    const { response } = await receive({ method: 'GET', url: '/demo' });
    expect(response.statusCode).toBe(404);
  });
});
