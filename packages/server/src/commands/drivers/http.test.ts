import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommandOf, Driver, SendContext, TargetOf } from './driver';
import { createHttpDriver, headerText, HTTP_TIMEOUT_MS } from './http';

interface Received {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

/**
 * A local HTTP server: /fail answers 500, /missing 404, /text 200 with a body, /slow never
 * answers, anything else 204. It records every request and counts its connections.
 */
let server: Server;
let baseUrl: string;
let received: Received[];
let connections: number;

beforeEach(async () => {
  received = [];
  connections = 0;
  server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => {
      received.push({ method: request.method!, url: request.url!, headers: request.headers, body });
      if (request.url === '/slow') return; // never answers
      if (request.url === '/text') return response.end('x'.repeat(100_000));
      response.statusCode = request.url === '/fail' ? 500 : request.url === '/missing' ? 404 : 204;
      response.end();
    });
  });
  server.on('connection', () => connections++);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const drivers: Driver<'http'>[] = [];
afterEach(async () => {
  await Promise.all(drivers.splice(0).map((driver) => driver.close()));
});
function open(options?: { timeoutMs?: number }): Driver<'http'> {
  const driver = createHttpDriver(options);
  drivers.push(driver);
  return driver;
}

const target = (url = baseUrl): TargetOf<'http'> => ({
  id: 't_demo00',
  name: 'Demo receiver',
  protocol: 'http',
  baseUrl: url,
});
const post: CommandOf<'http'> = {
  type: 'http',
  targetId: 't_demo00',
  method: 'POST',
  path: '/demo/screen-3/call-staff',
  body: '{ "stand": "B12" }',
};
const fromStation: SendContext = {
  source: { type: 'station', stationId: 'main' },
  hotspotName: 'Call our team',
};

describe('HTTP driver', () => {
  it('sends the method, path and body to the base URL', async () => {
    await open().send(target(), post, fromStation);
    expect(received).toMatchObject([
      { method: 'POST', url: '/demo/screen-3/call-staff', body: '{ "stand": "B12" }' },
    ]);
  });

  it('sends a GET without a body', async () => {
    await open().send(target(), { ...post, method: 'GET', body: null }, fromStation);
    expect(received).toMatchObject([{ method: 'GET', body: '' }]);
    expect(received[0]?.headers['content-length']).toBeUndefined();
  });

  it('reads the answer to the end, so later commands reuse the connection', async () => {
    const driver = open();
    for (let i = 0; i < 10; i++) {
      await driver.send(target(), { ...post, path: '/text' }, fromStation);
    }
    expect(received).toHaveLength(10);
    // A fresh client may open a second connection; dropping the answer would open one per command.
    expect(connections).toBeLessThan(5);
  });

  it('keeps a path in the base URL, with or without a trailing slash', async () => {
    const driver = open();
    await driver.send(target(`${baseUrl}/api`), post, fromStation);
    await driver.send(target(`${baseUrl}/api/`), post, fromStation);
    expect(received.map((request) => request.url)).toEqual([
      '/api/demo/screen-3/call-staff',
      '/api/demo/screen-3/call-staff',
    ]);
  });

  describe('headers (spec TGT-6)', () => {
    it('names the station and the hotspot', async () => {
      await open().send(target(), post, fromStation);
      expect(received[0]?.headers).toMatchObject({
        'x-tapcue-station': 'main',
        'x-tapcue-hotspot': 'Call our team',
      });
    });

    it('marks a send from the editor as "test"', async () => {
      await open().send(target(), post, { ...fromStation, source: { type: 'test' } });
      expect(received[0]?.headers['x-tapcue-station']).toBe('test');
    });

    it('percent-encodes a hotspot name outside printable ASCII, and the receiver can decode it', async () => {
      await open().send(target(), post, { ...fromStation, hotspotName: 'Кнопка 100%' });
      const header = received[0]?.headers['x-tapcue-hotspot'] as string;
      expect(header).toBe('%D0%9A%D0%BD%D0%BE%D0%BF%D0%BA%D0%B0 100%25');
      expect(decodeURIComponent(header)).toBe('Кнопка 100%');
    });

    it('sends an empty header for a hotspot without a name', async () => {
      await open().send(target(), post, { ...fromStation, hotspotName: '' });
      expect(received[0]?.headers['x-tapcue-hotspot']).toBe('');
    });
  });

  describe('delivery errors (spec TGT-5)', () => {
    it('waits 2 s for an answer by default', () => {
      expect(HTTP_TIMEOUT_MS).toBe(2000);
    });

    it('fails on a non-2xx answer', async () => {
      await expect(open().send(target(), { ...post, path: '/fail' }, fromStation)).rejects.toThrow(
        `${baseUrl}/fail answered 500 Internal Server Error`,
      );
    });

    it('fails on a 4xx answer too', async () => {
      await expect(
        open().send(target(), { ...post, path: '/missing' }, fromStation),
      ).rejects.toThrow(`${baseUrl}/missing answered 404 Not Found`);
    });

    it('fails when the target does not answer in time', async () => {
      const started = Date.now();
      await expect(
        open({ timeoutMs: 100 }).send(target(), { ...post, path: '/slow' }, fromStation),
      ).rejects.toThrow(`${baseUrl}/slow did not answer within 0.1 s`);
      expect(Date.now() - started).toBeLessThan(1000);
    });

    it('fails when nothing listens at the address', async () => {
      const port = (server.address() as AddressInfo).port;
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await expect(open().send(target(), post, fromStation)).rejects.toThrow(
        `Could not reach http://127.0.0.1:${port}/demo/screen-3/call-staff: connect ECONNREFUSED`,
      );
      server.listen(0); // so afterEach has something to close
    });

    it('cancels a request in flight when the driver closes', async () => {
      const driver = open();
      const sending = driver.send(target(), { ...post, path: '/slow' }, fromStation);
      await new Promise((resolve) => setTimeout(resolve, 50)); // the request reaches the server
      await driver.close();
      await expect(sending).rejects.toThrow(
        `Request to ${baseUrl}/slow was cancelled: the server is stopping`,
      );
    });
  });
});

describe('headerText', () => {
  it.each([
    ['Product A', 'Product A'],
    ['', ''],
    ['50%', '50%25'],
    ['café', 'caf%C3%A9'],
    ['tab\there', 'tab%09here'],
    ['emoji 🎵', 'emoji %F0%9F%8E%B5'],
  ])('%j → %j', (text, header) => {
    expect(headerText(text)).toBe(header);
    expect(decodeURIComponent(header)).toBe(text);
  });
});
