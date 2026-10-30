import type { ServerMessage } from '@tapcue/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWebSocket } from '../test/fakeWebSocket';
import { openServerSocket, type SocketStatus, socketUrl } from './serverSocket';

beforeEach(() => {
  FakeWebSocket.all = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function open() {
  const messages: ServerMessage[] = [];
  const statuses: SocketStatus[] = [];
  const socket = openServerSocket({
    onMessage: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
  });
  return { socket, messages, statuses, server: FakeWebSocket.last };
}

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
  it('reports connecting, then open, then closed when the connection drops', () => {
    const { statuses, server } = open();
    server.open();
    server.drop();
    expect(statuses).toEqual(['connecting', 'open', 'closed']);
  });

  it('does not report closed when the page closes it', () => {
    const { socket, statuses, server } = open();
    server.open();
    socket.close();
    expect(statuses).toEqual(['connecting', 'open']);
  });

  it('passes on valid server messages', () => {
    const { messages, server } = open();
    server.open();
    server.receive({ type: 'pong' });
    expect(messages).toEqual([{ type: 'pong' }]);
  });

  it('answers the server ping with a pong, and does not pass the ping on (architecture §7)', () => {
    const { messages, server } = open();
    server.open();
    server.receive({ type: 'ping' });
    expect(server.sent).toEqual([{ type: 'pong' }]);
    expect(messages).toEqual([]);
  });

  it('skips a message it cannot read, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { messages, server } = open();
    server.open();
    server.receive({ type: 'tap', pageId: 'p_home00', hotspotId: 'h_call00' });
    server.receive('not json');
    expect(messages).toEqual([]);
    expect(warn).toHaveBeenCalledWith('Ignored a message from the server: Not valid JSON');
  });

  it('sends only while open', () => {
    const { socket, server } = open();
    socket.send({ type: 'ping' }); // still connecting: dropped
    server.open();
    socket.send({ type: 'ping' });
    expect(server.sent).toEqual([{ type: 'ping' }]);
  });
});
