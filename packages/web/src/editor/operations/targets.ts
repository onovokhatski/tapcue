// Target operations: pure functions (project, args) => project (spec TGT-1, ED-4, project format
// §6, §10). An operation that cannot apply returns the same project.
import type { Hotspot, Page, Project, Protocol, Target, TargetId } from '@tapcue/shared';
import { newId } from './ids';

/** Adds an OSC over UDP target with a placeholder address, named "Target N". Returns its id too. */
export function addTarget(
  project: Project,
  random?: () => number,
): { project: Project; targetId: TargetId } {
  const targetId = newId(
    't',
    project.targets.map((t) => t.id),
    random,
  );
  const names = new Set(project.targets.map((t) => t.name));
  let n = project.targets.length + 1;
  while (names.has(`Target ${n}`)) n++;
  const target: Target = {
    id: targetId,
    name: `Target ${n}`,
    protocol: 'osc-udp',
    host: '127.0.0.1',
    port: 7000,
  };
  return { project: { ...project, targets: [...project.targets, target] }, targetId };
}

/** Changes a target's name or address; the protocol changes with `changeProtocol`. */
export function updateTarget(
  project: Project,
  targetId: TargetId,
  change: Partial<Pick<Target, 'name'>> & { host?: string; port?: number; baseUrl?: string },
): Project {
  const target = project.targets.find((t) => t.id === targetId);
  if (!target) return project;
  const next = { ...target, ...pick(target, change) };
  if (JSON.stringify(next) === JSON.stringify(target)) return project;
  return { ...project, targets: project.targets.map((t) => (t.id === targetId ? next : t)) };
}

/** Only the fields the target's protocol has, so an HTTP target never gets a host. */
function pick(target: Target, change: Record<string, unknown>) {
  const allowed = target.protocol === 'http' ? ['name', 'baseUrl'] : ['name', 'host', 'port'];
  return Object.fromEntries(Object.entries(change).filter(([key]) => allowed.includes(key)));
}

/**
 * Switches a target to another protocol. Its commands are cleared, since a command must match its
 * target's protocol (project format §10); page links stay. Host and port carry over between the
 * two UDP protocols.
 */
export function changeProtocol(project: Project, targetId: TargetId, protocol: Protocol): Project {
  const target = project.targets.find((t) => t.id === targetId);
  if (!target || target.protocol === protocol) return project;
  const base = { id: target.id, name: target.name };
  const address =
    target.protocol === 'http'
      ? { host: '127.0.0.1', port: 7000 }
      : { host: target.host, port: target.port };
  const next: Target =
    protocol === 'http'
      ? { ...base, protocol, baseUrl: 'http://localhost:8080' }
      : { ...base, protocol, ...address };
  return clearCommands(
    { ...project, targets: project.targets.map((t) => (t.id === targetId ? next : t)) },
    targetId,
  );
}

/** Deletes a target and clears the commands that sent to it; page links stay (design: dialog). */
export function deleteTarget(project: Project, targetId: TargetId): Project {
  if (!project.targets.some((t) => t.id === targetId)) return project;
  return clearCommands(
    { ...project, targets: project.targets.filter((t) => t.id !== targetId) },
    targetId,
  );
}

/** The hotspots that send their command to a target, with their page. */
export function targetUsage(
  project: Project,
  targetId: TargetId,
): { page: Page; hotspot: Hotspot }[] {
  return project.pages.flatMap((page) =>
    page.hotspots
      .filter((h) => h.action.command?.targetId === targetId)
      .map((hotspot) => ({ page, hotspot })),
  );
}

function clearCommands(project: Project, targetId: TargetId): Project {
  return {
    ...project,
    pages: project.pages.map((page) =>
      page.hotspots.some((h) => h.action.command?.targetId === targetId)
        ? {
            ...page,
            hotspots: page.hotspots.map((h) =>
              h.action.command?.targetId === targetId
                ? { ...h, action: { ...h.action, command: null } }
                : h,
            ),
          }
        : page,
    ),
  };
}
