// Taps made while the player is offline, kept for a short while (spec PLY-3). A late reconnect
// must not start content the visitor has already moved on from, so old taps are dropped.
import type { ClientMessage } from '@tapcue/shared';

export const TAP_MAX_AGE_MS = 5000;

export interface TapQueue {
  add(message: ClientMessage): void;
  /** Empties the queue and returns the taps still young enough to send, oldest first. */
  takeFresh(): ClientMessage[];
}

export function createTapQueue(now: () => number = Date.now): TapQueue {
  let queued: { message: ClientMessage; at: number }[] = [];
  return {
    add(message) {
      queued.push({ message, at: now() });
    },
    takeFresh() {
      const time = now();
      const fresh = queued.filter((tap) => time - tap.at <= TAP_MAX_AGE_MS);
      queued = [];
      return fresh.map((tap) => tap.message);
    },
  };
}
