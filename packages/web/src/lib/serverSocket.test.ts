import type { ServerMessage } from '@tapcue/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWebSocket } from '../test/fakeWebSocket';
import {
  openServerSocket,
  RECONNECT_DELAYS_MS,
  SILENCE_LIMIT_MS,
  type SocketStatus,
  socketUrl,
} from './serverSocket';

// The test setup puts FakeWebSocket in place of WebSocket.
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function open() {
  const messages: ServerMessage[] = [];
  const statuses: SocketStatus[] = [];
  const socket = openServerSocket({
    onMessage: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
  });
  return { socket, messages, statuses };
}

const sockets = () => FakeWebSocket.all.length;

describe('socketUrl', () => {
  it('uses the page host, with ws: or wss: to match the page', () => {
    expect(socketUrl({ protocol: 'http:', host: '192.168.1.10:5173' })).toBe(
      'ws://192.168.1.10:5173/ws',
    );
    expect(socketUrl({ protocol: 'https:', host: 'demo.tapcue.app' })).toBe(
      'wss://demo.tapcue.app/ws',
    );
  });
});

describe('openServerSocket', () => {
  it('reports connecting, then open', () => {
    const { statuses } = open();
    FakeWebSocket.last.open();
    expect(statuses).toEqual(['connecting', 'open']);
  });

  it('passes on valid server messages', () => {
    const { messages } = open();
    FakeWebSocket.last.open();
    FakeWebSocket.last.receive({ type: 'pong' });
    expect(messages).toEqual([{ type: 'pong' }]);
  });

  it('answers the server ping with a pong, and does not pass the ping on (architecture §7)', () => {
    const { messages } = open();
    FakeWebSocket.last.open();
    FakeWebSocket.last.receive({ type: 'ping' });
    expect(FakeWebSocket.last.sent).toEqual([{ type: 'pong' }]);
    expect(messages).toEqual([]);
  });

  it('skips a message it cannot read, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { messages } = open();
    FakeWebSocket.last.open();
    FakeWebSocket.last.receive({ type: 'tap', pageId: 'p_home00', hotspotId: 'h_call00' });
    FakeWebSocket.last.receive('not json');
    expect(messages).toEqual([]);
    expect(warn).toHaveBeenCalledWith('Ignored a message from the server: Not valid JSON');
  });

  it('sends only while open, and says whether it did', () => {
    const { socket } = open();
    expect(socket.send({ type: 'ping' })).toBe(false);
    FakeWebSocket.last.open();
    expect(socket.send({ type: 'ping' })).toBe(true);
    expect(FakeWebSocket.last.sent).toEqual([{ type: 'ping' }]);
  });

  describe('reconnecting (spec PLY-3, architecture §7)', () => {
    it('waits 1, 2, 4, 8 s, then every 10 s', () => {
      expect(RECONNECT_DELAYS_MS).toEqual([1000, 2000, 4000, 8000, 10_000]);
    });

    it('reports closed when the connection drops, and tries again after 1 s', () => {
      const { statuses } = open();
      FakeWebSocket.last.open();
      FakeWebSocket.last.drop();
      expect(statuses).toEqual(['connecting', 'open', 'closed']);
      vi.advanceTimersByTime(999);
      expect(sockets()).toBe(1);
      vi.advanceTimersByTime(1);
      expect(sockets()).toBe(2);
      expect(statuses.at(-1)).toBe('connecting');
    });

    it('waits longer after each failed attempt, at most 10 s', () => {
      open();
      const waits: number[] = [];
      for (let attempt = 0; attempt < 7; attempt++) {
        FakeWebSocket.last.drop(); // the server is not there: each attempt fails
        const before = sockets();
        let waited = 0;
        while (sockets() === before) {
          vi.advanceTimersByTime(1000);
          waited += 1000;
        }
        waits.push(waited);
      }
      expect(waits).toEqual([1000, 2000, 4000, 8000, 10_000, 10_000, 10_000]);
    });

    it('starts again from 1 s once a connection has opened', () => {
      open();
      FakeWebSocket.last.drop();
      vi.advanceTimersByTime(1000);
      FakeWebSocket.last.drop();
      vi.advanceTimersByTime(2000);
      FakeWebSocket.last.open(); // back
      FakeWebSocket.last.drop();
      vi.advanceTimersByTime(1000);
      expect(sockets()).toBe(4);
    });

    it('treats 15 s without any message as a dead connection, even if the browser has not noticed', () => {
      const { statuses } = open();
      const first = FakeWebSocket.last;
      first.open();
      vi.advanceTimersByTime(10_000);
      first.receive({ type: 'ping' }); // the server's ping keeps it alive
      vi.advanceTimersByTime(SILENCE_LIMIT_MS - 1);
      expect(statuses.at(-1)).toBe('open');
      vi.advanceTimersByTime(1);
      expect(statuses.at(-1)).toBe('closed');
      expect(first.readyState).toBe(FakeWebSocket.CLOSED);
      vi.advanceTimersByTime(1000);
      expect(sockets()).toBe(2);
    });

    it('waits 15 s of silence before giving up on a connection', () => {
      expect(SILENCE_LIMIT_MS).toBe(15_000);
    });

    it('ignores a replaced socket: a late close from it starts no second attempt', () => {
      open();
      const first = FakeWebSocket.last;
      first.open();
      vi.advanceTimersByTime(SILENCE_LIMIT_MS + 1000); // silence: replaced
      expect(sockets()).toBe(2);
      first.dispatchEvent(new Event('close'));
      vi.advanceTimersByTime(10_000);
      expect(sockets()).toBe(2);
    });

    it('stops for good when the page closes it', () => {
      const { socket, statuses } = open();
      FakeWebSocket.last.open();
      socket.close();
      vi.advanceTimersByTime(60_000);
      expect(sockets()).toBe(1);
      expect(statuses).toEqual(['connecting', 'open']);
    });

    it('cancels a waiting attempt when the page closes it', () => {
      const { socket } = open();
      FakeWebSocket.last.drop();
      socket.close();
      vi.advanceTimersByTime(60_000);
      expect(sockets()).toBe(1);
    });
  });
});
