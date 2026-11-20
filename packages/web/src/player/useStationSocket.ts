// The player's connection to the server: says which station it is, carries its taps and fader
// values, keeps taps made while offline for a few seconds and the last value of each fader, holds
// the fader values the server shares, and passes on what the server says
// (spec ACT-2, ST-3, PLY-2, PLY-3, PLY-5, FD-2, FD-4, FD-5, architecture §7).
import type { ClientMessage, HotspotId, ServerMessage } from '@tapcue/shared';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { openServerSocket, type ServerSocket, type SocketStatus } from '../lib/serverSocket';
import { createTapQueue } from './tapQueue';

export interface StationSocket {
  status: SocketStatus;
  /** Sends a tap now, or queues it until the connection is back. */
  sendTap: (message: ClientMessage) => void;
  /** Sends a fader value now; offline, keeps only the last one per fader until the connection is back. */
  sendValue: (message: FaderValueMessage) => void;
  /** Fader values: those the server shares, and this tablet's own as soon as it sends them. */
  faderValues: Readonly<Record<HotspotId, number>>;
}

export type FaderValueMessage = Extract<ClientMessage, { type: 'value' }>;

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
  const [faderValues, setFaderValues] = useState<Record<HotspotId, number>>({});
  // The last value of each fader dragged while offline: a level, not an event, so it never expires.
  const unsent = useRef(new Map<HotspotId, FaderValueMessage>());
  // Always the latest callbacks, without opening a new connection when they change.
  const opened = useEffectEvent(() => onOpen?.());
  const received = useEffectEvent((message: ServerMessage) => onMessage?.(message));

  useEffect(() => {
    const connection = openServerSocket({
      // Pings are answered inside openServerSocket.
      onMessage: (message) => {
        if (message.type === 'fader-values') {
          setFaderValues((current) => ({ ...current, ...message.values }));
        }
        received(message);
      },
      onStatus: (next) => {
        setStatus(next);
        if (next !== 'open') return;
        // hello on every open, so the server always knows the station behind this connection;
        // then the taps made while offline that are still fresh.
        connection.send({ type: 'hello', stationId });
        for (const tap of queue.current.takeFresh()) connection.send(tap);
        // Then where each fader was left, as a final value, so the server sends and logs it.
        for (const value of unsent.current.values()) connection.send({ ...value, final: true });
        unsent.current.clear();
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
    sendValue: (message) => {
      // Shown at once, also offline; the server's copy comes back the same, snapped alike.
      setFaderValues((current) => ({ ...current, [message.hotspotId]: message.value }));
      if (!socket.current?.send(message)) unsent.current.set(message.hotspotId, message);
    },
    faderValues,
  };
}
