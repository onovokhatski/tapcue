// The browser's end of /ws (architecture §5.2, §7). It keeps the connection up on its own: a
// connection that drops or goes silent is replaced, with growing pauses between attempts, so a
// stand's Wi-Fi can come and go without anyone reloading a page (spec PLY-3).
import { ServerMessage, parseMessage, type ClientMessage } from '@tapcue/shared';

/** `closed`: the connection was lost and the next attempt is waiting for its turn. */
export type SocketStatus = 'connecting' | 'open' | 'closed';

/** Pauses before attempts 1, 2, 3, …; the last one repeats (architecture §7). */
export const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 10_000];

/**
 * The server pings every 10 s and closes a connection that does not answer within 5 s. A
 * connection that has heard nothing for this long is dead, even if the browser has not noticed:
 * after a Wi-Fi drop that can take minutes.
 */
export const SILENCE_LIMIT_MS = 15_000;

export interface ServerSocketOptions {
  onMessage: (message: ServerMessage) => void;
  onStatus?: (status: SocketStatus) => void;
}

export interface ServerSocket {
  /** Sends at once and returns true while open; returns false and sends nothing otherwise. */
  send(message: ClientMessage): boolean;
  /** Closes for good: no more attempts. */
  close(): void;
}

/** Same host as the page: Vite proxies /ws in development, the server answers it in production. */
export function socketUrl(location: Pick<Location, 'protocol' | 'host'> = window.location) {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

export function openServerSocket({ onMessage, onStatus }: ServerSocketOptions): ServerSocket {
  let socket: WebSocket | null = null;
  let failures = 0;
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;

  const send = (message: ClientMessage) => {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  };

  function connect() {
    const current = new WebSocket(socketUrl());
    socket = current;
    onStatus?.('connecting');

    // Every message proves the connection alive, the server's pings included.
    const heard = () => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => lost(current), SILENCE_LIMIT_MS);
    };

    current.addEventListener('open', () => {
      failures = 0;
      heard();
      onStatus?.('open');
    });
    current.addEventListener('message', (event) => {
      heard();
      if (typeof event.data !== 'string') return;
      const parsed = parseMessage(ServerMessage, event.data);
      if (!parsed.ok) {
        // A newer server may send messages this page does not know yet; nothing to do with them.
        console.warn(`Ignored a message from the server: ${parsed.error}`);
        return;
      }
      // The server closes a connection that does not answer its pings (architecture §7).
      if (parsed.message.type === 'ping') send({ type: 'pong' });
      else onMessage(parsed.message);
    });
    current.addEventListener('close', () => lost(current));
  }

  /** Gives up on `lost` and schedules the next attempt; later events of that socket are ignored. */
  function lost(dead: WebSocket) {
    if (dead !== socket || stopped) return;
    socket = null;
    clearTimeout(silenceTimer);
    dead.close(); // a silent socket may still be open in the browser's view
    onStatus?.('closed');
    const delay = RECONNECT_DELAYS_MS[failures] ?? RECONNECT_DELAYS_MS.at(-1);
    failures++;
    retryTimer = setTimeout(connect, delay);
  }

  connect();

  return {
    send,
    close() {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(silenceTimer);
      socket?.close();
      socket = null;
    },
  };
}
