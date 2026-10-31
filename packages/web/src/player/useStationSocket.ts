// The player's connection to the server: says which station it is, carries its taps, keeps
// taps made while offline for a few seconds, and passes on what the server says
// (spec ACT-2, ST-3, PLY-2, PLY-3, PLY-5, architecture §7).
import type { ClientMessage, ServerMessage } from '@tapcue/shared';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { openServerSocket, type ServerSocket, type SocketStatus } from '../lib/serverSocket';
import { createTapQueue } from './tapQueue';

export interface StationSocket {
  status: SocketStatus;
  /** Sends a tap now, or queues it until the connection is back. */
  sendTap: (message: ClientMessage) => void;
}

export interface StationSocketEvents {
  /** The connection opened: the first time, and after every reconnect. */
  onOpen?: () => void;
  onMessage?: (message: ServerMessage) => void;
}

/** `stationId` is the one in the URL; the server ignores a hello with an id that is not valid. */
export function useStationSocket(
  stationId: string,
  { onOpen, onMessage }: StationSocketEvents = {},
): StationSocket {
  const socket = useRef<ServerSocket | null>(null);
  const queue = useRef(createTapQueue());
  const [status, setStatus] = useState<SocketStatus>('connecting');
  // Always the latest callbacks, without opening a new connection when they change.
  const opened = useEffectEvent(() => onOpen?.());
  const received = useEffectEvent((message: ServerMessage) => onMessage?.(message));

  useEffect(() => {
    const connection = openServerSocket({
      // Pings are answered inside openServerSocket.
      onMessage: (message) => received(message),
      onStatus: (next) => {
        setStatus(next);
        if (next !== 'open') return;
        // hello on every open, so the server always knows the station behind this connection;
        // then the taps made while offline that are still fresh.
        connection.send({ type: 'hello', stationId });
        for (const tap of queue.current.takeFresh()) connection.send(tap);
        opened();
      },
    });
    socket.current = connection;
    return () => {
      connection.close();
      socket.current = null;
    };
  }, [stationId]);

  return {
    status,
    sendTap: (message) => {
      if (!socket.current?.send(message)) queue.current.add(message);
    },
  };
}
