// What a tap does: go to a page, send a command to a target, or both (spec ACT-1). Pure functions
// (project, args) => project; an operation that cannot apply returns the same project.
import type { Command, HotspotId, PageId, Project, Target, TargetId } from '@tapcue/shared';
import { setAction } from './hotspots';

/** A page to go to after the tap, or null to stay. A hotspot never links to its own page. */
export function setGoTo(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  goTo: PageId | null,
): Project {
  if (goTo === pageId || (goTo !== null && !project.pages.some((p) => p.id === goTo)))
    return project;
  return setAction(project, pageId, hotspotId, (action) => ({ ...action, goTo }));
}

/**
 * Chooses the target to send to, or none. A target of the same protocol keeps the command and only
 * changes where it goes; another protocol starts the empty command of that protocol, since a
 * command must match its target's protocol (project format §10).
 */
export function setCommandTarget(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  targetId: TargetId | null,
): Project {
  if (targetId === null)
    return setAction(project, pageId, hotspotId, (action) => ({ ...action, command: null }));
  const target = project.targets.find((t) => t.id === targetId);
  if (!target) return project;
  return setAction(project, pageId, hotspotId, (action) => ({
    ...action,
    command:
      action.command?.type === target.protocol
        ? { ...action.command, targetId }
        : emptyCommand(target),
  }));
}

/** Replaces the command; its type and target must stay those of its target (callers edit fields). */
export function setCommand(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  command: Command,
): Project {
  const target = project.targets.find((t) => t.id === command.targetId);
  if (!target || target.protocol !== command.type) return project;
  return setAction(project, pageId, hotspotId, (action) => ({ ...action, command }));
}

/** The command a new choice of target starts with: valid, and doing nothing surprising. */
export function emptyCommand(target: Target): Command {
  switch (target.protocol) {
    case 'osc-udp':
      return { type: 'osc-udp', targetId: target.id, address: '/', args: [] };
    case 'udp':
      // UDP text cannot be empty; "GO", the theatre word for "start the cue", until it is written.
      return { type: 'udp', targetId: target.id, text: 'GO' };
    case 'http':
      return { type: 'http', targetId: target.id, method: 'POST', path: '/', body: null };
  }
}
