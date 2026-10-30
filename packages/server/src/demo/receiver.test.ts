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
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
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
      },
    ]);
    expect(DemoRequest.safeParse(received[0]).success).toBe(true);
  });

  it('reports a request without a body with body null', async () => {
    const { received } = await receive({ method: 'POST', url: '/demo/screen-1/product-a' });
    expect(received).toMatchObject([{ screen: 'screen-1', content: 'product-a', body: null }]);
  });

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
