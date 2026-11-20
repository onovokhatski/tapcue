// Fader values (spec FD-2–FD-4, ADR 0020): a value from a player → checked against the fader's
// range and snapped to its step → held for every tablet → sent at a limited rate as the fader's
// command with the value inserted → one log entry per drag, for the value where the finger stopped.
import type {
  FaderSettings,
  HotspotId,
  LogEntry,
  LogSource,
  PageId,
  Project,
  Protocol,
} from '@tapcue/shared';
import { snapFaderValue } from '@tapcue/shared';
import type { Drivers } from './dispatcher';
import type { Driver } from './drivers/driver';
import type { CommandLog } from './log';

/** About 25 commands a second per fader while it is dragged (spec FD-3). */
export const SEND_INTERVAL_MS = 40;

export interface FaderValue {
  source: LogSource;
  pageId: PageId;
  hotspotId: HotspotId;
  value: number;
  /** Where the finger stopped: always sent, and logged. */
  final: boolean;
}

export interface FadersOptions {
  /** Read on every value, so a value always uses the project as it is now. */
  project: () => Project;
  drivers: Drivers;
  log: CommandLog;
  intervalMs?: number;
  now?: () => Date;
}

export interface Faders {
  /** Takes a value from a player; returns the log entry once a final value is handled. */
  receive(input: FaderValue): Promise<LogEntry | null>;
  /** The current value of every fader in the project: the last one received, or its start. */
  values(): Record<HotspotId, number>;
  /** Called with each value that was taken, so it can be shown on every tablet. */
  subscribe(listener: (hotspotId: HotspotId, value: number) => void): () => void;
  /** Drops pending sends when the server stops. */
  close(): void;
}

/** The fader's OSC command with the value inserted where its settings say, as f or i. */
export function withValue<C extends { args: unknown[] }>(
  command: C,
  { value: place }: FaderSettings,
  value: number,
): C {
  const arg =
    place.as === 'i'
      ? { type: 'i' as const, value: Math.round(value) }
      : { type: 'f' as const, value };
  const args = [...command.args];
  args.splice(place.at, 0, arg);
  return { ...command, args };
}

interface Pending {
  input: FaderValue;
  value: number;
}

interface FaderState {
  lastSentAt: number;
  pending: Pending | null;
  timer: NodeJS.Timeout | null;
}

export function createFaders({
  project,
  drivers,
  log,
  intervalMs = SEND_INTERVAL_MS,
  now = () => new Date(),
}: FadersOptions): Faders {
  const held = new Map<HotspotId, number>();
  const states = new Map<HotspotId, FaderState>();
  const listeners = new Set<(hotspotId: HotspotId, value: number) => void>();

  const find = (pageId: PageId, hotspotId: HotspotId) =>
    project()
      .pages.find((p) => p.id === pageId)
      ?.hotspots.find((h) => h.id === hotspotId);

  /** Sends the value as the fader's command; logs only a final value, so a drag is one entry. */
  async function send({ input, value }: Pending): Promise<LogEntry | null> {
    const base = {
      time: now().toISOString(),
      source: input.source,
      pageId: input.pageId,
      hotspotId: input.hotspotId,
    };
    const hotspot = find(input.pageId, input.hotspotId);
    const command = hotspot?.action.command;
    if (!hotspot?.fader || !command || command.type !== 'osc-udp') return null;
    const current = project();
    const target = current.targets.find((t) => t.id === command.targetId);
    if (!target || target.protocol !== command.type) {
      return input.final
        ? log.add({
            ...base,
            status: 'ignored',
            message: `Target "${command.targetId}" does not exist or uses another protocol`,
          })
        : null;
    }
    const sent = withValue(command, hotspot.fader, value);
    const delivery = { hotspotName: hotspot.name, targetName: target.name, command: sent };
    try {
      // As in the dispatcher: the check above pairs target and command by protocol.
      const driver = drivers[target.protocol] as Driver<Protocol>;
      await driver.send(target, sent, { source: input.source, hotspotName: hotspot.name });
      return input.final ? log.add({ ...base, ...delivery, status: 'sent' }) : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return input.final ? log.add({ ...base, ...delivery, status: 'error', message }) : null;
    }
  }

  /**
   * At most one send per interval for each fader; a value that comes sooner waits and is replaced
   * by any later one, so the last value always goes out (spec FD-3).
   */
  function schedule(pending: Pending): Promise<LogEntry | null> {
    const id = pending.input.hotspotId;
    const state = states.get(id) ?? { lastSentAt: -Infinity, pending: null, timer: null };
    states.set(id, state);
    const wait = state.lastSentAt + intervalMs - Date.now();
    if (wait <= 0 && !state.timer) {
      state.lastSentAt = Date.now();
      return send(pending);
    }
    state.pending = pending;
    return new Promise((resolve) => {
      if (state.timer) {
        // A send is already waiting: it takes this value instead; this call has nothing to report.
        resolve(null);
        return;
      }
      state.timer = setTimeout(
        () => {
          state.timer = null;
          const next = state.pending;
          state.pending = null;
          if (!next) return resolve(null);
          state.lastSentAt = Date.now();
          void send(next).then(resolve);
        },
        Math.max(0, wait),
      );
    });
  }

  return {
    receive(input) {
      const hotspot = find(input.pageId, input.hotspotId);
      const ignore = (message: string) =>
        // Only a final value is logged: a broken drag must not flood the log.
        Promise.resolve(
          input.final
            ? log.add({
                time: now().toISOString(),
                source: input.source,
                pageId: input.pageId,
                hotspotId: input.hotspotId,
                status: 'ignored',
                message,
              })
            : null,
        );
      if (!hotspot)
        return ignore(`Hotspot "${input.hotspotId}" does not exist on page "${input.pageId}"`);
      if (hotspot.kind !== 'fader' || !hotspot.fader) {
        return ignore(`Hotspot "${hotspot.name}" is not a fader: it takes taps, not values`);
      }
      const { min, max } = hotspot.fader;
      if (input.value < min || input.value > max) {
        return ignore(
          `Value ${input.value} is outside "${hotspot.name}"'s range, ${min} to ${max}`,
        );
      }
      const value = snapFaderValue(input.value, hotspot.fader);
      held.set(input.hotspotId, value);
      for (const listener of listeners) listener(input.hotspotId, value);
      if (!hotspot.action.command) return Promise.resolve(null); // a fader that sends nothing yet
      return schedule({ input, value });
    },
    values() {
      const values: Record<HotspotId, number> = {};
      for (const page of project().pages) {
        for (const hotspot of page.hotspots) {
          if (hotspot.kind !== 'fader' || !hotspot.fader) continue;
          // A held value is kept within the range, in case the range changed since (spec FD-4).
          const { min, max, start } = hotspot.fader;
          values[hotspot.id] = Math.min(max, Math.max(min, held.get(hotspot.id) ?? start));
        }
      }
      return values;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      for (const state of states.values()) if (state.timer) clearTimeout(state.timer);
      states.clear();
    },
  };
}
