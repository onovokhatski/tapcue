// The command log: the latest entries in memory, and a way to hear about new ones (spec TGT-4).
// It is not saved: it explains what happened during a session, it is not an audit trail.
import type { LogEntry } from '@tapcue/shared';

/** Enough for a day of browsing on a stand, small enough to send to an editor that opens. */
export const LOG_LIMIT = 500;

/** A log entry before the log numbers it. Spread over the union, so each status keeps its own fields. */
export type NewLogEntry = LogEntry extends infer E
  ? E extends LogEntry
    ? Omit<E, 'seq'>
    : never
  : never;

export interface CommandLog {
  /** Numbers the entry, keeps it, and tells every subscriber. */
  add(entry: NewLogEntry): LogEntry;
  /** The kept entries, oldest first. */
  entries(): LogEntry[];
  /** Calls `listener` for every new entry; returns a function that stops it. */
  subscribe(listener: (entry: LogEntry) => void): () => void;
}

export function createCommandLog(limit = LOG_LIMIT): CommandLog {
  const kept: LogEntry[] = [];
  const listeners = new Set<(entry: LogEntry) => void>();
  let nextSeq = 0;

  return {
    add(fields) {
      const entry: LogEntry = { ...fields, seq: nextSeq++ };
      kept.push(entry);
      if (kept.length > limit) kept.shift();
      for (const listener of listeners) listener(entry);
      return entry;
    },
    entries: () => [...kept],
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
