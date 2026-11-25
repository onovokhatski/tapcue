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

/** How long a page with a web background stays when the project does not say (spec PG-10). */
export const DEFAULT_WEB_PAGE_SECONDS = 180;

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
  /** Seconds a page with a web background stays before the idle return (spec PG-10, ADR 0024). */
  webPageSeconds: z
    .int('Expected a whole number of seconds')
    .min(10, 'Expected 10 to 3600 seconds')
    .max(3600, 'Expected 10 to 3600 seconds')
    .optional(),
});
export type Project = z.infer<typeof Project>;

/** The project's web page time, or the default when it has none. */
export const webPageSeconds = (project: Project) =>
  project.webPageSeconds ?? DEFAULT_WEB_PAGE_SECONDS;
