// Entry points for tablets (docs/project-format.md §8).
import { z } from 'zod';
import { Name, PageId, StationId } from './values';

export const Station = z.strictObject({
  id: StationId,
  name: Name,
  startPageId: PageId,
  /** Seconds without a tap before returning to the start page; null = never. */
  idleTimeoutSeconds: z
    .int('Expected a whole number of seconds')
    .min(5, 'Expected 5 to 3600 seconds')
    .max(3600, 'Expected 5 to 3600 seconds')
    .nullable(),
});
export type Station = z.infer<typeof Station>;
