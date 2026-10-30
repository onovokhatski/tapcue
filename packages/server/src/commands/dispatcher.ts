// A tap → the hotspot's command in the server's project → the target's driver → the log
// (spec ACT-1, TGT-4, ST-5, ADR 0005, architecture §5.3).
import type { HotspotId, LogSource, PageId, Project, Protocol } from '@tapcue/shared';
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
  /** Read on every tap, so a tap always uses the project as it is now. */
  project: () => Project;
  drivers: Drivers;
  log: CommandLog;
  now?: () => Date;
}

export type Dispatch = (tap: Tap) => Promise<void>;

export function createDispatcher({
  project,
  drivers,
  log,
  now = () => new Date(),
}: DispatcherOptions): Dispatch {
  /**
   * Resolves once the command is sent or has failed, and never rejects: a broken target or an
   * outdated tablet must not take the server down (architecture §7). Taps are not coordinated:
   * each one is sent, and the last one wins on the media server (spec ST-5).
   */
  return async function dispatch({ source, pageId, hotspotId }) {
    const base = { time: now().toISOString(), source, pageId, hotspotId };
    const ignore = (message: string) => log.add({ ...base, status: 'ignored', message });

    const current = project();
    const page = current.pages.find((p) => p.id === pageId);
    if (!page) return void ignore(`Page "${pageId}" does not exist`);
    const hotspot = page.hotspots.find((h) => h.id === hotspotId);
    if (!hotspot) return void ignore(`Hotspot "${hotspotId}" does not exist on page "${pageId}"`);

    const { command } = hotspot.action;
    if (!command) return; // a hotspot that only navigates: nothing to send, nothing to log
    // A validated project has the target, with the command's protocol (docs/project-format.md §10).
    const target = current.targets.find((t) => t.id === command.targetId);
    if (!target || target.protocol !== command.type) {
      return void ignore(`Target "${command.targetId}" does not exist or uses another protocol`);
    }

    const delivery = { hotspotName: hotspot.name, targetName: target.name, command };
    try {
      // The check above pairs target and command by protocol; the types cannot follow that across
      // the union, so the driver is called as a driver of any protocol.
      const driver = drivers[target.protocol] as Driver<Protocol>;
      await driver.send(target, command, { source, hotspotName: hotspot.name });
      log.add({ ...base, ...delivery, status: 'sent' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.add({ ...base, ...delivery, status: 'error', message });
    }
  };
}
