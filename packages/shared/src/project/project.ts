// The whole project.json (docs/project-format.md §2). This is the shape layer only;
// references between objects are checked across the whole project (§10).
import { z } from 'zod';
import { Canvas } from './canvas';
import { Page } from './pages';
import { Station } from './stations';
import { Target } from './targets';
import { Name } from './values';

/** Version 2 since v0.5: an action's `command` became `commands` (ADR 0022, upgrade.ts). */
export const SCHEMA_VERSION = 2;

export const Project = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION, {
    error: (issue) =>
      `This project uses schema version ${String(issue.input)}; this version of Tapcue reads version ${SCHEMA_VERSION}`,
  }),
  name: Name,
  canvas: Canvas,
  pages: z.array(Page).min(1, 'A project needs at least one page'),
  targets: z.array(Target),
  stations: z.array(Station),
});
export type Project = z.infer<typeof Project>;
