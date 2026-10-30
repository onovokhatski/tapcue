// The player's connection to the server: says which station it is, carries its taps, and keeps
// taps made while offline for a few seconds (spec ACT-2, ST-3, PLY-2, PLY-3, architecture §7).
import type { ClientMessage, StationId } from '@tapcue/shared';
import { useEffect, useRef, useState } from 'react';
import { openServerSocket, type ServerSocket, type SocketStatus } from '../lib/serverSocket';
import { createTapQueue } from './tapQueue';

export interface StationSocket {
  status: SocketStatus;
  /** Sends a tap now, or queues it until the connection is back. */
  sendTap: (message: ClientMessage) => void;
}

export function useStationSocket(stationId: StationId): StationSocket {
  const socket = useRef<ServerSocket | null>(null);
  const queue = useRef(createTapQueue());
  const [status, setStatus] = useState<SocketStatus>('connecting');

  useEffect(() => {
    const opened = openServerSocket({
      // The player listens to nothing yet; pings are answered inside openServerSocket.
      onMessage: () => undefined,
      onStatus: (next) => {
        setStatus(next);
        if (next !== 'open') return;
        // hello on every open, so the server always knows the station behind this connection;
        // then the taps made while offline that are still fresh.
        opened.send({ type: 'hello', stationId });
        for (const tap of queue.current.takeFresh()) opened.send(tap);
      },
    });
    socket.current = opened;
    return () => {
      opened.close();
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
