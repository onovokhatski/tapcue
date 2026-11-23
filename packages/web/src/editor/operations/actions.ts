// What a tap does: go to a page, send commands to targets, or both (spec ACT-1). Pure functions
// (project, args) => project; an operation that cannot apply returns the same project.
//
// The editor edits the first command of a sequence for now and keeps the others as they are; the
// whole list with its delays comes with #203 (ADR 0022).
import {
  type Action,
  type Command,
  firstCommand,
  type HotspotId,
  type PageId,
  type Project,
  type Target,
  type TargetId,
  VALUE_PLACEHOLDER,
} from '@tapcue/shared';
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
  if (targetId === null) {
    return setAction(project, pageId, hotspotId, (action) => withFirstCommand(action, null));
  }
  const target = project.targets.find((t) => t.id === targetId);
  if (!target) return project;
  const fader = project.pages
    .find((p) => p.id === pageId)
    ?.hotspots.some((h) => h.id === hotspotId && h.kind === 'fader');
  return setAction(project, pageId, hotspotId, (action) => {
    const command = firstCommand(action);
    return withFirstCommand(
      action,
      command?.type === target.protocol ? { ...command, targetId } : emptyCommand(target, fader),
    );
  });
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
  return setAction(project, pageId, hotspotId, (action) => withFirstCommand(action, command));
}

/**
 * The action with its first command replaced, keeping that step's delay and every later step;
 * null removes the first step.
 */
export function withFirstCommand(action: Action, command: Command | null): Action {
  const [first, ...rest] = action.commands;
  if (command === null) return { ...action, commands: rest };
  return { ...action, commands: [{ ...first, command }, ...rest] };
}

/**
 * The command a new choice of target starts with: valid, and doing nothing surprising. A fader's
 * UDP and HTTP commands start with {value}, the place of its value (ADR 0020).
 */
export function emptyCommand(target: Target, fader = false): Command {
  switch (target.protocol) {
    case 'osc-udp':
      return { type: 'osc-udp', targetId: target.id, address: '/', args: [] };
    case 'udp':
      // UDP text cannot be empty; "GO", the theatre word for "start the cue", until it is written.
      return { type: 'udp', targetId: target.id, text: fader ? VALUE_PLACEHOLDER : 'GO' };
    case 'http':
      return {
        type: 'http',
        targetId: target.id,
        method: 'POST',
        path: fader ? `/${VALUE_PLACEHOLDER}` : '/',
        body: null,
      };
  }
}
