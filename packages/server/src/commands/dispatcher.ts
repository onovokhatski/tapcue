// A tap → the hotspot's commands in the server's project → the targets' drivers → the log
// (spec ACT-1, ACT-5 to ACT-8, TGT-4, ST-5, ADR 0005, ADR 0022, architecture §5.3).
//
// A hotspot's commands are a sequence: each step is sent after its delay, on the server's own
// timers, so a tablet that sleeps or moves on does not stop it. A new tap on the same hotspot
// cancels the steps not yet sent and starts over.
import type {
  Hotspot,
  HotspotId,
  LogEntry,
  LogSource,
  PageId,
  Project,
  Protocol,
  SequenceStep,
  Step,
} from '@tapcue/shared';
import type { Driver } from './drivers/driver';
import type { CommandLog } from './log';

/** One driver per protocol. A new protocol fails to compile until its driver is added here. */
export type Drivers = { [P in Protocol]: Driver<P> };

export interface Tap {
  source: LogSource;
  pageId: PageId;
  hotspotId: HotspotId;
}

export interface DispatcherOptions {
  /** Read on every step, so a step always uses the project as it is now. */
  project: () => Project;
  drivers: Drivers;
  log: CommandLog;
  now?: () => Date;
}

/**
 * Resolves with the log entry of the tap's first command once it is sent or has failed; null for a
 * hotspot that only navigates, or whose first command waits for its delay.
 */
export type Dispatch = (tap: Tap) => Promise<LogEntry | null>;

export interface Dispatcher {
  dispatch: Dispatch;
  /** Cancels every sequence still running, and logs why, e.g. another project was opened (PRJ-7). */
  cancelAll(reason: string): void;
  /** Drops every pending step without a word: the server stops. */
  close(): void;
}

/** One tap's sequence while it runs. */
interface Run extends Tap {
  id: number;
  /** The step to send next, counted from 0, and how many steps the hotspot had when last read. */
  next: number;
  of: number;
  timer: NodeJS.Timeout | null;
}

export function createDispatcher({
  project,
  drivers,
  log,
  now = () => new Date(),
}: DispatcherOptions): Dispatcher {
  /** The sequence each hotspot runs or ran last: one per hotspot, since a new tap starts over (ACT-7). */
  const running = new Map<HotspotId, Run>();
  let runs = 0;

  const base = ({ source, pageId, hotspotId }: Tap) => ({
    time: now().toISOString(),
    source,
    pageId,
    hotspotId,
  });

  const find = (pageId: PageId, hotspotId: HotspotId): Hotspot | undefined =>
    project()
      .pages.find((p) => p.id === pageId)
      ?.hotspots.find((h) => h.id === hotspotId);

  /**
   * Stops a run before its next step and logs how many steps were not sent, from the first of
   * them, so the log says what the media server did not get.
   */
  function stop(run: Run, reason: string) {
    if (run.timer) clearTimeout(run.timer);
    run.timer = null;
    if (running.get(run.hotspotId) === run) running.delete(run.hotspotId);
    const left = run.of - run.next;
    if (left <= 0) return;
    log.add({
      ...base(run),
      sequence: { run: run.id, step: run.next + 1, of: run.of, delayMs: 0 },
      status: 'ignored',
      message: `${left} ${left === 1 ? 'step' : 'steps'} cancelled: ${reason}`,
    });
  }

  /**
   * Sends step `index` as the hotspot has it now, and schedules the next one. The next step's delay
   * counts from when this one is sent, not from its answer, so a slow or failing target does not
   * push the rest of the sequence back (ACT-8).
   */
  function runStep(run: Run, index: number): Promise<LogEntry | null> {
    run.timer = null;
    const hotspot = find(run.pageId, run.hotspotId);
    const steps = hotspot && hotspot.kind !== 'fader' ? hotspot.action.commands : [];
    const step = steps[index];
    if (!hotspot || !step) {
      // The hotspot was deleted or lost its later steps since the tap: nothing left to send.
      stop(run, 'the hotspot changed');
      return Promise.resolve(null);
    }
    run.next = index + 1;
    run.of = steps.length;
    // A finished run may stay in `running` until the next tap: with no step left, there is
    // nothing to cancel, and there is at most one entry per hotspot.
    const following = steps[index + 1];
    if (following) {
      run.timer = setTimeout(() => void runStep(run, index + 1), following.delayMs ?? 0);
    }
    const sequence =
      steps.length > 1 || step.delayMs
        ? { run: run.id, step: index + 1, of: steps.length, delayMs: step.delayMs ?? 0 }
        : undefined;
    return send(run, hotspot, step, sequence);
  }

  /** Never rejects: a broken target must not take the server down (architecture §7). */
  async function send(
    tap: Tap,
    hotspot: Hotspot,
    { command }: Step,
    sequence: SequenceStep | undefined,
  ): Promise<LogEntry> {
    const entry = { ...base(tap), ...(sequence ? { sequence } : {}) };
    // A validated project has the target, with the command's protocol (docs/project-format.md §10).
    const target = project().targets.find((t) => t.id === command.targetId);
    if (!target || target.protocol !== command.type) {
      return log.add({
        ...entry,
        status: 'ignored',
        message: `Target "${command.targetId}" does not exist or uses another protocol`,
      });
    }
    const delivery = { hotspotName: hotspot.name, targetName: target.name, command };
    try {
      // The check above pairs target and command by protocol; the types cannot follow that across
      // the union, so the driver is called as a driver of any protocol.
      const driver = drivers[target.protocol] as Driver<Protocol>;
      await driver.send(target, command, {
        source: tap.source,
        hotspotName: hotspot.name,
        ...(sequence && {
          sequence: { run: sequence.run, step: sequence.step, of: sequence.of },
        }),
      });
      return log.add({ ...entry, ...delivery, status: 'sent' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return log.add({ ...entry, ...delivery, status: 'error', message });
    }
  }

  /**
   * Starts the hotspot's sequence. Taps on different hotspots are not coordinated: each one is
   * sent, and the last one wins on the media server (spec ST-5).
   */
  function dispatch(tap: Tap): Promise<LogEntry | null> {
    const ignore = (message: string) =>
      Promise.resolve(log.add({ ...base(tap), status: 'ignored', message }));

    const page = project().pages.find((p) => p.id === tap.pageId);
    if (!page) return ignore(`Page "${tap.pageId}" does not exist`);
    const hotspot = page.hotspots.find((h) => h.id === tap.hotspotId);
    if (!hotspot)
      return ignore(`Hotspot "${tap.hotspotId}" does not exist on page "${tap.pageId}"`);
    // A fader sends values, not taps (ADR 0020): its command is incomplete without one.
    if (hotspot.kind === 'fader') {
      return ignore(`Hotspot "${hotspot.name}" is a fader: taps send nothing`);
    }

    // Tapped again, from any station: the media server is shared, so the sequence starts over.
    const previous = running.get(tap.hotspotId);
    if (previous) stop(previous, 'tapped again');

    const [first] = hotspot.action.commands;
    if (!first) return Promise.resolve(null); // only navigates: nothing to send, nothing to log
    const run: Run = {
      ...tap,
      id: runs++,
      next: 0,
      of: hotspot.action.commands.length,
      timer: null,
    };
    // One command sent at once has nothing to cancel later, so it is not kept as running.
    if (run.of > 1 || first.delayMs) running.set(tap.hotspotId, run);
    if (!first.delayMs) return runStep(run, 0);
    run.timer = setTimeout(() => void runStep(run, 0), first.delayMs);
    return Promise.resolve(null);
  }

  return {
    dispatch,
    cancelAll(reason) {
      for (const run of [...running.values()]) stop(run, reason);
    },
    close() {
      for (const run of running.values()) if (run.timer) clearTimeout(run.timer);
      running.clear();
    },
  };
}
