// What a tap does: go to a page, send a sequence of commands, or both (spec ACT-1, ACT-5, ACT-6,
// ACT-9, ADR 0022). Pure functions (project, args) => project; an operation that cannot apply returns the
// same project. Steps have no ids: their place in the list names them, as in the editor.
import {
  type Action,
  activeSteps,
  type Command,
  type HotspotId,
  MAX_DELAY_MS,
  MAX_STEPS,
  type PageId,
  type Project,
  type Step,
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
 * Chooses the target of step `index`, or none, which removes the step. A target of the same
 * protocol keeps the command and only changes where it goes; another protocol starts the empty
 * command of that protocol, since a command must match its target's protocol (project format §10).
 * Index 0 of an action without commands adds its first step.
 */
export function setCommandTarget(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  targetId: TargetId | null,
  index = 0,
): Project {
  if (targetId === null) {
    return setAction(project, pageId, hotspotId, (action) => withStep(action, index, null));
  }
  const target = project.targets.find((t) => t.id === targetId);
  if (!target) return project;
  const fader = project.pages
    .find((p) => p.id === pageId)
    ?.hotspots.some((h) => h.id === hotspotId && h.kind === 'fader');
  return setAction(project, pageId, hotspotId, (action) => {
    const command = action.commands[index]?.command;
    return withStep(
      action,
      index,
      command?.type === target.protocol ? { ...command, targetId } : emptyCommand(target, fader),
    );
  });
}

/**
 * Replaces the command of step `index`; its type and target must stay those of its target (callers
 * edit fields).
 */
export function setCommand(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  command: Command,
  index = 0,
): Project {
  const target = project.targets.find((t) => t.id === command.targetId);
  if (!target || target.protocol !== command.type) return project;
  return setAction(project, pageId, hotspotId, (action) => withStep(action, index, command));
}

/**
 * The action with the command of step `index` replaced, keeping that step's delay; null removes
 * the step. An index just past the end adds a step; any other missing index changes nothing.
 */
export function withStep(action: Action, index: number, command: Command | null): Action {
  const steps = action.commands;
  if (index < 0 || index > steps.length) return action;
  if (command === null) return { ...action, commands: steps.filter((_, i) => i !== index) };
  if (index === steps.length) {
    if (steps.length >= MAX_STEPS) return action;
    return { ...action, commands: [...steps, { command }] };
  }
  return {
    ...action,
    commands: steps.map((step, i) => (i === index ? { ...step, command } : step)),
  };
}

/**
 * Adds a command after the last one, to the target of the step before so a sequence to one media
 * server is quick to build, or to the first target. Nothing changes at MAX_STEPS or without a
 * target.
 */
export function addStep(project: Project, pageId: PageId, hotspotId: HotspotId): Project {
  return setAction(project, pageId, hotspotId, (action) => {
    const last = action.commands.at(-1);
    const target =
      project.targets.find((t) => t.id === last?.command.targetId) ?? project.targets[0];
    return target ? withStep(action, action.commands.length, emptyCommand(target)) : action;
  });
}

/** Moves step `from` to place `to` (clamped to the list). */
export function moveStep(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  from: number,
  to: number,
): Project {
  return setAction(project, pageId, hotspotId, (action) => {
    const steps = [...action.commands];
    const target = Math.max(0, Math.min(to, steps.length - 1));
    if (from < 0 || from >= steps.length || from === target) return action;
    const [step] = steps.splice(from, 1);
    steps.splice(target, 0, step!);
    return { ...action, commands: steps };
  });
}

/**
 * Sets the pause before step `index` in milliseconds, whole and within 0 to 60 s (spec ACT-6); 0
 * leaves the field out, as a step without a pause is written.
 */
export function setStepDelay(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  index: number,
  delayMs: number,
): Project {
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > MAX_DELAY_MS) return project;
  return setAction(project, pageId, hotspotId, (action) => {
    const step = action.commands[index];
    if (!step) return action;
    const { delayMs: _old, ...rest } = step;
    const next: Step = delayMs === 0 ? rest : { ...rest, delayMs };
    return { ...action, commands: action.commands.map((s, i) => (i === index ? next : s)) };
  });
}

/**
 * Names step `index`, trimmed, up to 100 characters; an empty name leaves the field out and the
 * editor shows "Command N" again (spec ACT-9).
 */
export function setStepName(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  index: number,
  name: string,
): Project {
  const trimmed = name.trim();
  if (trimmed.length > 100) return project;
  return updateStep(project, pageId, hotspotId, index, (step) => {
    const { name: _old, ...rest } = step;
    return trimmed === '' ? rest : { ...rest, name: trimmed };
  });
}

/**
 * Switches step `index` on or off (spec ACT-9). On leaves the field out, as a step that is on is
 * written; off is skipped with its pause when the hotspot is tapped.
 */
export function setStepEnabled(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  index: number,
  enabled: boolean,
): Project {
  return updateStep(project, pageId, hotspotId, index, (step) => {
    const { enabled: _old, ...rest } = step;
    return enabled ? rest : { ...rest, enabled: false };
  });
}

function updateStep(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  index: number,
  update: (step: Step) => Step,
): Project {
  // A missing step changes nothing, and setAction then keeps the same project.
  return setAction(project, pageId, hotspotId, (action) => ({
    ...action,
    commands: action.commands.map((s, i) => (i === index ? update(s) : s)),
  }));
}

/**
 * How long a sequence takes from the tap to its last step: the sum of the pauses of the steps that
 * are on, in ms. A step that is off is skipped with its pause (spec ACT-9).
 */
export function sequenceLength(action: Action): number {
  return activeSteps(action).reduce((sum, step) => sum + (step.delayMs ?? 0), 0);
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
