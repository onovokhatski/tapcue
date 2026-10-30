// The player's connection to the server: says which station it is, then carries its taps
// (spec ACT-2, ST-3, architecture §5.2). Reconnecting and queueing taps come with #53.
import type { ClientMessage, StationId } from '@tapcue/shared';
import { useEffect, useRef } from 'react';
import { openServerSocket, type ServerSocket } from '../lib/serverSocket';

/** Returns a function that sends a message; while the connection is not open, it is dropped. */
export function useStationSocket(stationId: StationId): (message: ClientMessage) => void {
  const socket = useRef<ServerSocket | null>(null);

  useEffect(() => {
    const opened = openServerSocket({
      // The player listens to nothing yet; pings are answered inside openServerSocket.
      onMessage: () => undefined,
      // hello on every open, so the server always knows the station behind this connection.
      onStatus: (status) => {
        if (status === 'open') opened.send({ type: 'hello', stationId });
      },
    });
    socket.current = opened;
    return () => {
      opened.close();
      socket.current = null;
    };
  }, [stationId]);

  return (message) => socket.current?.send(message);
}
