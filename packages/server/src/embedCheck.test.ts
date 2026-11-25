import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app';
import { DEFAULT_PROJECT_DIR } from './config';
import { checkEmbedding, embedVerdict } from './embedCheck';
import { loadProjectStore } from './project/store';

const verdict = (headers: Record<string, string>) => embedVerdict(new Headers(headers));

describe('embedVerdict (spec PG-9, ADR 0024)', () => {
  it('lets a page without frame headers be shown', () => {
    expect(verdict({})).toEqual({ result: 'ok' });
    expect(verdict({ 'content-security-policy': "default-src 'self'" })).toEqual({ result: 'ok' });
  });

  it.each(['DENY', 'SAMEORIGIN', 'deny', ' sameorigin '])('blocks X-Frame-Options: %s', (value) => {
    expect(verdict({ 'x-frame-options': value })).toEqual({
      result: 'blocked',
      reason: `the site forbids being shown in a frame (X-Frame-Options: ${value.trim().toUpperCase()})`,
    });
  });

  it('blocks when any of several X-Frame-Options values does', () => {
    expect(verdict({ 'x-frame-options': 'ALLOWALL, DENY' })).toMatchObject({ result: 'blocked' });
  });

  it.each(['ALLOW-FROM https://example.com', 'ALLOWALL', ''])(
    'ignores X-Frame-Options: %j, as browsers do',
    (value) => {
      expect(verdict({ 'x-frame-options': value })).toEqual({ result: 'ok' });
    },
  );

  it.each(["frame-ancestors 'none'", 'frame-ancestors', "frame-ancestors 'none' https://a.com"])(
    'blocks CSP %j, which allows no frame',
    (csp) => {
      expect(verdict({ 'content-security-policy': csp })).toEqual({
        result: 'blocked',
        reason: 'the site forbids being shown in a frame (Content-Security-Policy frame-ancestors)',
      });
    },
  );

  it.each([
    ["frame-ancestors 'self'", 'itself'],
    ["frame-ancestors 'self' https://partner.com", 'itself, https://partner.com'],
    ['frame-ancestors https:', 'https:'],
    ["default-src 'self'; Frame-Ancestors https://*.example.com", 'https://*.example.com'],
  ])('blocks CSP %j, naming what it allows', (csp, from) => {
    expect(verdict({ 'content-security-policy': csp })).toEqual({
      result: 'blocked',
      reason: `the site allows frames only from ${from} (Content-Security-Policy frame-ancestors)`,
    });
  });

  it.each(['frame-ancestors *', "frame-ancestors 'self' http:", 'frame-ancestors HTTP: https:'])(
    'allows CSP %j, which takes a stand on any address',
    (csp) => {
      expect(verdict({ 'content-security-policy': csp })).toEqual({ result: 'ok' });
    },
  );

  it('needs every policy with frame-ancestors to allow the stand', () => {
    expect(
      verdict({ 'content-security-policy': "frame-ancestors *, frame-ancestors 'self'" }),
    ).toMatchObject({ result: 'blocked' });
    expect(verdict({ 'content-security-policy': "frame-ancestors *, default-src 'self'" })).toEqual(
      { result: 'ok' },
    );
  });

  it('lets frame-ancestors decide alone, as browsers do over X-Frame-Options', () => {
    expect(
      verdict({ 'content-security-policy': 'frame-ancestors *', 'x-frame-options': 'DENY' }),
    ).toEqual({ result: 'ok' });
    expect(
      verdict({
        'content-security-policy': "frame-ancestors 'none'",
        'x-frame-options': 'ALLOWALL',
      }),
    ).toMatchObject({ result: 'blocked' });
  });

  it('ignores a report-only policy, which blocks nothing', () => {
    expect(verdict({ 'content-security-policy-report-only': "frame-ancestors 'none'" })).toEqual({
      result: 'ok',
    });
  });
});

describe('checkEmbedding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads only the headers, and lets go of a page however long it is', async () => {
    let cancelled = false;
    const endless = new ReadableStream({
      pull: (controller) => controller.enqueue(new Uint8Array(1024)),
      cancel: () => {
        cancelled = true;
      },
    });
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(endless, { status: 200 })));
    expect(await checkEmbedding('https://example.com', 1000)).toEqual({ result: 'ok' });
    expect(cancelled).toBe(true);
  });
});

describe('GET /api/embed-check', () => {
  const closing: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const close of closing.splice(0)) await close();
  });

  /** A site to check: each path answers with its own status and headers. */
  async function site(routes: Record<string, (res: ServerResponse) => void>) {
    const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const route = routes[req.url ?? ''];
      if (route) route(res);
      else res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    closing.push(
      () =>
        new Promise((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    );
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  async function tapcue(options: { demo?: boolean; timeoutMs?: number } = {}) {
    const store = await loadProjectStore(DEFAULT_PROJECT_DIR);
    const app: FastifyInstance = buildApp({
      store,
      demo: options.demo ?? false,
      embedCheck: { timeoutMs: options.timeoutMs ?? 2000 },
    });
    closing.push(() => app.close());
    return (url: string) =>
      app.inject({ method: 'GET', url: `/api/embed-check?url=${encodeURIComponent(url)}` });
  }

  it('says a page without frame headers can be embedded', async () => {
    const base = await site({ '/': (res) => res.writeHead(200).end('<h1>Hi</h1>') });
    const response = await (await tapcue())(`${base}/`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ result: 'ok' });
  });

  it('says why a page that forbids frames cannot', async () => {
    const base = await site({
      '/': (res) => res.writeHead(200, { 'x-frame-options': 'DENY' }).end(),
      '/csp': (res) =>
        res.writeHead(200, { 'content-security-policy': "frame-ancestors 'self'" }).end(),
    });
    const check = await tapcue();
    expect((await check(`${base}/`)).json()).toEqual({
      result: 'blocked',
      reason: 'the site forbids being shown in a frame (X-Frame-Options: DENY)',
    });
    expect((await check(`${base}/csp`)).json()).toMatchObject({ result: 'blocked' });
  });

  it('judges the page a redirect leads to, as a frame shows that one', async () => {
    const base = await site({
      '/old': (res) => res.writeHead(302, { location: '/new' }).end(),
      '/new': (res) => res.writeHead(200, { 'x-frame-options': 'SAMEORIGIN' }).end(),
    });
    expect((await (await tapcue())(`${base}/old`)).json()).toMatchObject({ result: 'blocked' });
  });

  it('says an address that answers with an error is unreachable', async () => {
    const base = await site({});
    expect((await (await tapcue())(`${base}/missing`)).json()).toEqual({
      result: 'unreachable',
      reason: 'the address answered 404',
    });
  });

  it('says an address with nothing behind it is unreachable', async () => {
    const base = await site({});
    const check = await tapcue();
    await closing.shift()!(); // the site is gone before the check
    expect((await check(`${base}/`)).json()).toEqual({
      result: 'unreachable',
      reason: 'the address cannot be reached',
    });
  });

  it('gives up on a site that does not answer in time', async () => {
    const base = await site({ '/slow': () => {} }); // never answers
    expect((await (await tapcue({ timeoutMs: 200 }))(`${base}/slow`)).json()).toEqual({
      result: 'unreachable',
      reason: 'no answer within 0.2 s',
    });
  });

  it.each(['ftp://example.com', 'file:///etc/passwd', 'example.com', ''])(
    'refuses %j, which is no web address',
    async (url) => {
      const response = await (await tapcue())(url);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'Expected an address starting with http:// or https://',
      });
    },
  );

  it('is refused in demo mode, so a public server never fetches on request', async () => {
    const response = await (await tapcue({ demo: true }))('https://example.com');
    expect(response.statusCode).toBe(403);
  });
});
