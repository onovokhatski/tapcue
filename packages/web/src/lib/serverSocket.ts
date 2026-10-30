// The browser's end of /ws (architecture §5.2). Viewers (the demo page, later the editor) only
// listen; the player will also send hello and taps (#52) and reconnect on its own (#53).
import { ServerMessage, parseMessage, type ClientMessage } from '@tapcue/shared';

export type SocketStatus = 'connecting' | 'open' | 'closed';

export interface ServerSocketOptions {
  onMessage: (message: ServerMessage) => void;
  onStatus?: (status: SocketStatus) => void;
}

export interface ServerSocket {
  send(message: ClientMessage): void;
  close(): void;
}

/** Same host as the page: Vite proxies /ws in development, the server answers it in production. */
export function socketUrl(location: Pick<Location, 'protocol' | 'host'> = window.location) {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

export function openServerSocket({ onMessage, onStatus }: ServerSocketOptions): ServerSocket {
  const socket = new WebSocket(socketUrl());
  let closedByUs = false;
  const send = (message: ClientMessage) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  onStatus?.('connecting');
  socket.addEventListener('open', () => onStatus?.('open'));
  socket.addEventListener('close', () => {
    if (!closedByUs) onStatus?.('closed');
  });
  socket.addEventListener('message', (event) => {
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

  return {
    send,
    close() {
      closedByUs = true;
      socket.close();
    },
  };
}
