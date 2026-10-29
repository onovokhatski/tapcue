// The single entry point for checking a project (docs/project-format.md §10):
// first the shape of every field, then the references between objects.
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
