// The WebSocket endpoint /ws (architecture §5.2, ADR 0006). Players say which station they are
// and send taps; editors and demo pages ("viewers") receive log entries and demo requests.
import websocket from '@fastify/websocket';
import { ClientMessage, parseMessage, type ServerMessage, type StationId } from '@tapcue/shared';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import type { Dispatch } from '../commands/dispatcher';
import type { CommandLog } from '../commands/log';

/** A silent dead connection is noticed within PING_INTERVAL + PONG_TIMEOUT (architecture §7). */
export const PING_INTERVAL_MS = 10_000;
export const PONG_TIMEOUT_MS = 5_000;

export interface HubOptions {
  dispatch: Dispatch;
  log: CommandLog;
  pingIntervalMs?: number;
  pongTimeoutMs?: number;
}

export interface Hub {
  /** Sends a message to every connection that is not a player: editors and demo pages. */
  toViewers(message: ServerMessage): void;
}

interface Connection {
  socket: WebSocket;
  /** Set by `hello`; a connection without one is a viewer. */
  stationId: StationId | null;
}

export function registerHub(
  app: FastifyInstance,
  { dispatch, log, pingIntervalMs = PING_INTERVAL_MS, pongTimeoutMs = PONG_TIMEOUT_MS }: HubOptions,
): Hub {
  const connections = new Set<Connection>();

  const send = (socket: WebSocket, message: ServerMessage) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };
  const hub: Hub = {
    toViewers(message) {
      for (const connection of connections) {
        if (connection.stationId === null) send(connection.socket, message);
      }
    },
  };

  const stopLog = log.subscribe((entry) => hub.toViewers({ type: 'log-entry', entry }));
  app.addHook('onClose', () => stopLog());

  void app.register(websocket);
  // A route with `websocket: true` must be added after the plugin has loaded, hence its own
  // plugin: Fastify loads plugins in the order they are registered.
  void app.register((scoped, _options, done) => {
    scoped.get('/ws', { websocket: true }, (socket, request) => onConnection(socket, request.log));
    done();
  });

  function onConnection(socket: WebSocket, logger: FastifyBaseLogger) {
    const connection: Connection = { socket, stationId: null };
    connections.add(connection);

    // Ping now and then; a connection that does not answer in time is closed.
    let pongTimer: NodeJS.Timeout | undefined;
    const pingTimer = setInterval(() => {
      send(socket, { type: 'ping' });
      pongTimer ??= setTimeout(() => socket.terminate(), pongTimeoutMs);
    }, pingIntervalMs);

    socket.on('message', (data, isBinary) => {
      const parsed = isBinary
        ? ({ ok: false, error: 'Binary frames are not used' } as const)
        : parseMessage(ClientMessage, text(data));
      if (!parsed.ok) {
        // A broken or outdated client: skip the message, keep the connection.
        logger.warn(`Ignored a WebSocket message: ${parsed.error}`);
        return;
      }
      const message = parsed.message;
      switch (message.type) {
        case 'hello':
          connection.stationId = message.stationId;
          break;
        case 'tap':
          // A tap needs a station to name as its source; a player always says hello first.
          if (connection.stationId === null) {
            logger.warn('Ignored a tap before hello');
            break;
          }
          // Fire and forget: dispatch never rejects, and the player does not wait (spec ACT-3).
          void dispatch({
            source: { type: 'station', stationId: connection.stationId },
            pageId: message.pageId,
            hotspotId: message.hotspotId,
          });
          break;
        case 'ping':
          send(socket, { type: 'pong' });
          break;
        case 'pong':
          clearTimeout(pongTimer);
          pongTimer = undefined;
          break;
      }
    });

    socket.on('close', () => {
      clearInterval(pingTimer);
      clearTimeout(pongTimer);
      connections.delete(connection);
    });
  }

  return hub;
}

/** ws hands over a frame as a Buffer by default; the other shapes only with other settings. */
function text(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return data.toString('utf8');
}
