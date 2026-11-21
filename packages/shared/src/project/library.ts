// The project library's API shapes (ADR 0021): what a new project needs, and the list of projects.
// Shared so the editor's projects page and the server agree on them.
import { z } from 'zod';
import { Canvas } from './canvas';
import type { ValidationError } from './validate';
import { Name } from './values';

/** A new, empty project: its name and canvas size (spec PRJ-6). */
export const NewProject = z.strictObject({
  name: Name,
  width: Canvas.shape.width,
  height: Canvas.shape.height,
});
export type NewProject = z.infer<typeof NewProject>;

/**
 * One project folder in the library (spec PRJ-5). `id` is the folder's name; `modified` is when
 * its project.json last changed. A project that does not load says why instead of its details.
 */
export type ProjectEntry = { id: string; active: boolean; modified: string } & (
  | { ok: true; name: string; width: number; height: number }
  | { ok: false; errors: ValidationError[] }
);

/** GET /api/projects. `active.id` is null for a project opened with --project outside the library. */
export interface ProjectList {
  projects: ProjectEntry[];
  active: { id: string | null; name: string };
}
