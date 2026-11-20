// The single entry point for checking a project (docs/project-format.md §10):
// first the shape of every field, then the references between objects.
import { VALUE_PLACEHOLDER } from './fader';
import type { Hotspot } from './pages';
import { Project } from './project';

/** One problem, with the exact place in project.json, e.g. `pages[2].hotspots[0].action.goTo`. */
export interface ValidationError {
  path: string;
  message: string;
}

export type ValidationResult =
  { ok: true; project: Project } | { ok: false; errors: ValidationError[] };

/** Never throws: invalid input is an expected case (a hand-edited file, an editor save). */
export function validateProject(input: unknown): ValidationResult {
  const shape = Project.safeParse(input);
  if (!shape.success) {
    // References cannot be checked reliably while the shape is wrong, so stop at the shape errors.
    return {
      ok: false,
      errors: shape.error.issues.map((issue) => ({
        path: formatPath(issue.path),
        message: issue.message,
      })),
    };
  }
  const errors = referenceErrors(shape.data);
  return errors.length ? { ok: false, errors } : { ok: true, project: shape.data };
}

/** ['pages', 2, 'hotspots', 0, 'id'] → "pages[2].hotspots[0].id" */
export function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((key, i) => (typeof key === 'number' ? `[${key}]` : `${i === 0 ? '' : '.'}${String(key)}`))
    .join('');
}

function referenceErrors(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const error = (path: string, message: string) => errors.push({ path, message });

  // Every id must be unique within its kind; the error is reported at the second use.
  const firstUse = new Map<string, string>();
  const checkUnique = (kind: string, id: string, path: string) => {
    const key = `${kind}:${id}`;
    const earlier = firstUse.get(key);
    if (earlier) error(path, `${kind} id "${id}" is already used by ${earlier}`);
    else firstUse.set(key, path.replace(/\.id$/, ''));
  };

  const pageIds = new Set(project.pages.map((page) => page.id));
  const targets = new Map(project.targets.map((target) => [target.id, target]));
  const { width, height } = project.canvas;

  project.targets.forEach((target, t) => checkUnique('target', target.id, `targets[${t}].id`));

  project.stations.forEach((station, s) => {
    const path = `stations[${s}]`;
    checkUnique('station', station.id, `${path}.id`);
    if (!pageIds.has(station.startPageId)) {
      error(`${path}.startPageId`, `page "${station.startPageId}" does not exist`);
    }
  });

  project.pages.forEach((page, p) => {
    checkUnique('page', page.id, `pages[${p}].id`);

    page.hotspots.forEach((hotspot, h) => {
      const path = `pages[${p}].hotspots[${h}]`;
      checkUnique('hotspot', hotspot.id, `${path}.id`);

      if (hotspot.x + hotspot.width > width || hotspot.y + hotspot.height > height) {
        error(
          path,
          `hotspot reaches outside the ${width} × ${height} canvas ` +
            `(right edge ${hotspot.x + hotspot.width}, bottom edge ${hotspot.y + hotspot.height})`,
        );
      }

      faderErrors(hotspot, path).forEach(({ path: at, message }) => error(at, message));

      const { goTo, command } = hotspot.action;
      if (goTo !== null && !pageIds.has(goTo)) {
        error(`${path}.action.goTo`, `page "${goTo}" does not exist`);
      }
      if (command !== null) {
        const target = targets.get(command.targetId);
        if (!target) {
          error(`${path}.action.command.targetId`, `target "${command.targetId}" does not exist`);
        } else if (target.protocol !== command.type) {
          error(
            `${path}.action.command.type`,
            `a "${command.type}" command cannot be sent to target "${target.name}", which uses "${target.protocol}"`,
          );
        }
      }
    });
  });

  return errors;
}

/**
 * A fader and its settings go together, its numbers fit, it changes no page and plays no press
 * effect, and its command has a place for the value: an OSC argument position within the
 * arguments, or {value} in UDP text or an HTTP path or body (spec FD-1, FD-2, ADR 0020).
 */
function faderErrors(hotspot: Hotspot, path: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const error = (at: string, message: string) => errors.push({ path: `${path}${at}`, message });

  if (hotspot.kind !== 'fader') {
    if (hotspot.fader) error('.fader', 'only a fader has fader settings; set kind to "fader"');
    return errors;
  }

  const { fader } = hotspot;
  const { command } = hotspot.action;
  if (!fader) {
    error('.fader', 'a fader needs its settings: orientation, min, max, step, start and value');
  } else {
    if (fader.min >= fader.max) {
      error('.fader.max', `expected more than min (${fader.min})`);
    } else {
      if (fader.step > fader.max - fader.min) {
        error('.fader.step', `expected at most the range, ${fader.max - fader.min}`);
      }
      if (fader.start < fader.min || fader.start > fader.max) {
        error('.fader.start', `expected ${fader.min} to ${fader.max}`);
      }
    }
    if (fader.value.as === 'i' && !Number.isInteger(fader.step)) {
      error('.fader.value.as', 'a whole-number value needs a whole-number step');
    }
    if (command?.type === 'osc-udp' && fader.value.at > command.args.length) {
      error('.fader.value.at', `expected 0 to ${command.args.length}, the number of arguments`);
    }
  }
  if (hotspot.action.goTo !== null) error('.action.goTo', 'a fader does not change the page');
  if (hotspot.pressEffect !== 'none') error('.pressEffect', 'a fader has no press effect');
  // UDP text and HTTP have no arguments: a placeholder marks where the value goes.
  if (command?.type === 'udp' && !command.text.includes(VALUE_PLACEHOLDER)) {
    error('.action.command.text', `expected ${VALUE_PLACEHOLDER} where the fader's value goes`);
  }
  if (
    command?.type === 'http' &&
    !command.path.includes(VALUE_PLACEHOLDER) &&
    !(command.body ?? '').includes(VALUE_PLACEHOLDER)
  ) {
    error(
      '.action.command.path',
      `expected ${VALUE_PLACEHOLDER} in the path or the body, where the fader's value goes`,
    );
  }
  return errors;
}
