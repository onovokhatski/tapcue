// Fader values (spec FD-2–FD-4, ADR 0020): a value from a player → checked against the fader's
// range and snapped to its step → held for every tablet → sent at a limited rate as the fader's
// command with the value in its place → one log entry per drag, for the value where the finger
// stopped.
import type {
  Command,
  FaderSettings,
  Hotspot,
  HotspotId,
  LogEntry,
  LogSource,
  PageId,
  Project,
  Protocol,
} from '@tapcue/shared';
import { activeSteps, fillValue, formatFaderValue, snapFaderValue } from '@tapcue/shared';
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
  /** Forgets every value and pending send: another project was opened (ADR 0021). */
  reset(): void;
}

/** The command a fader sends: its one command, unless that is switched off (spec ACT-9). */
function faderCommand(hotspot: Hotspot): Command | null {
  return activeSteps(hotspot.action)[0]?.command ?? null;
}

/**
 * The fader's command with the value in its place (ADR 0020): for OSC an argument inserted where
 * the settings say, as f or i; for UDP text and an HTTP path and body, every {value} replaced by
 * the value as text.
 */
export function withValue(command: Command, fader: FaderSettings, value: number): Command {
  const text = formatFaderValue(value, fader);
  switch (command.type) {
    case 'osc-udp': {
      const { at, as } = fader.value;
      const arg =
        as === 'i'
          ? { type: 'i' as const, value: Math.round(value) }
          : { type: 'f' as const, value };
      const args = [...command.args];
      args.splice(at, 0, arg);
      return { ...command, args };
    }
    case 'udp':
      return { ...command, text: fillValue(command.text, text) };
    case 'http':
      return {
        ...command,
        path: fillValue(command.path, text),
        body: command.body === null ? null : fillValue(command.body, text),
      };
  }
}

interface Pending {
  input: FaderValue;
  value: number;
}

interface FaderState {
  lastSentAt: number;
  pending: Pending | null;
  timer: NodeJS.Timeout | null;
  /** Values sent since the last final one: the drag in progress, for its log entry. */
  sentInDrag: number;
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

  function stateOf(id: HotspotId): FaderState {
    const state = states.get(id) ?? {
      lastSentAt: -Infinity,
      pending: null,
      timer: null,
      sentInDrag: 0,
    };
    states.set(id, state);
    return state;
  }

  /**
   * Sends the value as the fader's command; logs only a final value, so a drag is one entry that
   * says how many values it sent (ADR 0020).
   */
  async function send({ input, value }: Pending): Promise<LogEntry | null> {
    const state = stateOf(input.hotspotId);
    const base = {
      time: now().toISOString(),
      source: input.source,
      pageId: input.pageId,
      hotspotId: input.hotspotId,
    };
    const hotspot = find(input.pageId, input.hotspotId);
    // A fader's one command may be switched off: a drag then sends nothing (spec ACT-9).
    const command = hotspot && faderCommand(hotspot);
    if (!hotspot?.fader || !command) return null;
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
    state.sentInDrag += 1;
    const delivery = {
      hotspotName: hotspot.name,
      targetName: target.name,
      command: sent,
      valuesSent: state.sentInDrag,
    };
    // The next value starts a new drag.
    if (input.final) state.sentInDrag = 0;
    const { min, max } = hotspot.fader;
    const context = { source: input.source, hotspotName: hotspot.name, fader: { value, min, max } };
    try {
      // As in the dispatcher: the check above pairs target and command by protocol.
      const driver = drivers[target.protocol] as Driver<Protocol>;
      await driver.send(target, sent, context);
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
    const state = stateOf(id);
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

  function close() {
    for (const state of states.values()) if (state.timer) clearTimeout(state.timer);
    states.clear();
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
      if (!faderCommand(hotspot)) return Promise.resolve(null); // a fader that sends nothing (yet)
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
    close,
    reset() {
      close();
      held.clear();
    },
  };
}
