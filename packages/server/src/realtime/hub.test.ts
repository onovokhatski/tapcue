import type { AddressInfo } from 'node:net';
import type { ServerMessage } from '@tapcue/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tap } from '../commands/dispatcher';
import { createCommandLog, type CommandLog } from '../commands/log';
import { type Hub, PING_INTERVAL_MS, PONG_TIMEOUT_MS, registerHub } from './hub';

let app: FastifyInstance | undefined;
let hub: Hub;
let log: CommandLog;
let taps: Tap[];
let url: string;
const clients: WebSocket[] = [];

async function start(timing: { pingIntervalMs?: number; pongTimeoutMs?: number } = {}) {
  const server = Fastify();
  app = server;
  taps = [];
  log = createCommandLog();
  const dispatch = (tap: Tap) => {
    taps.push(tap);
    return Promise.resolve();
  };
  hub = registerHub(server, { dispatch, log, ...timing });
  await server.listen({ port: 0, host: '127.0.0.1' });
  url = `ws://127.0.0.1:${(server.server.address() as AddressInfo).port}/ws`;
}

afterEach(async () => {
  for (const client of clients.splice(0)) client.close();
  await app?.close();
  app = undefined;
});

/** A browser-like client that records what the server sends it. */
async function connect() {
  const socket = new WebSocket(url);
  clients.push(socket);
  const received: ServerMessage[] = [];
  socket.addEventListener('message', (event) => {
    received.push(JSON.parse(String(event.data)) as ServerMessage);
  });
  const closed = new Promise<void>((resolve) => socket.addEventListener('close', () => resolve()));
  await new Promise((resolve) => socket.addEventListener('open', resolve));
  return {
    socket,
    received,
    closed,
    send: (message: unknown) =>
      socket.send(typeof message === 'string' ? message : JSON.stringify(message)),
  };
}

/**
 * Waits until the server has handled everything sent so far: a ping is answered after the
 * messages before it, in order.
 */
async function settle(client: Awaited<ReturnType<typeof connect>>) {
  const pongs = client.received.filter((m) => m.type === 'pong').length;
  client.send({ type: 'ping' });
  await vi.waitFor(() => {
    expect(client.received.filter((m) => m.type === 'pong')).toHaveLength(pongs + 1);
  });
}

const tap = { type: 'tap', pageId: 'p_home00', hotspotId: 'h_call00' };

describe('WebSocket hub', () => {
  it('pings every 10 s and waits 5 s for the pong (architecture §7)', () => {
    expect([PING_INTERVAL_MS, PONG_TIMEOUT_MS]).toEqual([10_000, 5_000]);
  });

  describe('taps (spec ACT-2, ADR 0005)', () => {
    it('dispatches a tap with the station the player named in hello', async () => {
      await start();
      const player = await connect();
      player.send({ type: 'hello', stationId: 'kiosk-2' });
      player.send(tap);
      await settle(player);
      expect(taps).toEqual([
        {
          source: { type: 'station', stationId: 'kiosk-2' },
          pageId: 'p_home00',
          hotspotId: 'h_call00',
        },
      ]);
    });

    it('ignores a tap before hello, and keeps the connection', async () => {
      await start();
      const player = await connect();
      player.send(tap);
      player.send({ type: 'hello', stationId: 'main' });
      player.send(tap);
      await settle(player);
      expect(taps).toHaveLength(1);
    });

    it('takes taps from any number of tablets on the same station (spec ST-3)', async () => {
      await start();
      const first = await connect();
      const second = await connect();
      for (const player of [first, second]) player.send({ type: 'hello', stationId: 'main' });
      first.send(tap);
      second.send({ ...tap, hotspotId: 'h_carda0' });
      await settle(first);
      await settle(second);
      expect(taps.map((t) => t.hotspotId).sort()).toEqual(['h_call00', 'h_carda0']);
    });
  });

  describe('invalid messages', () => {
    it.each([
      ['text that is not JSON', '{type: tap'],
      ['an unknown type', { type: 'shout' }],
      ['a tap that carries a command', { ...tap, command: { type: 'udp' } }],
      ['a server message', { type: 'log-entry' }],
    ])('ignores %s and keeps the connection open', async (_, message) => {
      await start();
      const player = await connect();
      player.send({ type: 'hello', stationId: 'main' });
      player.send(message);
      player.send(tap);
      await settle(player);
      expect(taps).toHaveLength(1);
      expect(player.socket.readyState).toBe(WebSocket.OPEN);
    });

    it('ignores a binary frame', async () => {
      await start();
      const player = await connect();
      player.send({ type: 'hello', stationId: 'main' });
      player.socket.send(new TextEncoder().encode(JSON.stringify(tap)));
      await settle(player);
      expect(taps).toEqual([]);
    });
  });

  describe('viewers: editors and demo pages', () => {
    it('get each new log entry; players do not (spec TGT-4)', async () => {
      await start();
      const viewer = await connect();
      const player = await connect();
      player.send({ type: 'hello', stationId: 'main' });
      await settle(player);
      const entry = log.add({
        time: '2026-10-30T14:05:09.123Z',
        source: { type: 'station', stationId: 'main' },
        pageId: 'p_home00',
        hotspotId: 'h_gone00',
        status: 'ignored',
        message: 'Hotspot "h_gone00" does not exist on page "p_home00"',
      });
      await settle(viewer);
      await settle(player);
      expect(viewer.received).toContainEqual({ type: 'log-entry', entry });
      expect(player.received.filter((m) => m.type === 'log-entry')).toEqual([]);
    });

    it('get whatever the server sends to viewers, such as a demo request', async () => {
      await start();
      const viewer = await connect();
      const player = await connect();
      player.send({ type: 'hello', stationId: 'main' });
      await settle(player);
      const message: ServerMessage = {
        type: 'demo-received',
        request: {
          time: '2026-10-30T14:05:09.123Z',
          method: 'POST',
          path: '/demo/screen-1/product-a',
          screen: 'screen-1',
          content: 'product-a',
          body: null,
          station: 'main',
          hotspot: 'Play demo',
        },
      };
      hub.toViewers(message);
      await settle(viewer);
      await settle(player);
      expect(viewer.received).toContainEqual(message);
      expect(player.received).not.toContainEqual(message);
    });
  });

  describe('dead connections (architecture §7)', () => {
    it('answers a ping with a pong', async () => {
      await start();
      const client = await connect();
      await settle(client); // settle sends a ping and waits for the pong
    });

    it('keeps a client that answers the pings', async () => {
      await start({ pingIntervalMs: 30, pongTimeoutMs: 30 });
      const client = await connect();
      client.socket.addEventListener('message', (event) => {
        if (String(event.data).includes('"ping"')) client.send({ type: 'pong' });
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(client.received.filter((m) => m.type === 'ping').length).toBeGreaterThanOrEqual(3);
      expect(client.socket.readyState).toBe(WebSocket.OPEN);
    });

    it('closes a client that stops answering', async () => {
      await start({ pingIntervalMs: 30, pongTimeoutMs: 30 });
      const client = await connect();
      await client.closed;
      expect(client.received).toContainEqual({ type: 'ping' });
    });
  });
});
