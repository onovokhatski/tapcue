// The design size of every page and how it is scaled to a screen (docs/project-format.md §3).
import { z } from 'zod';
import { Color } from './values';

const Pixels = z
  .int('Expected a whole number of pixels')
  .min(1, 'Expected at least 1 px')
  .max(8192, 'Expected at most 8192 px');

/** fit: the whole page is visible, with bars where aspect ratios differ. fill: the screen is covered, edges may be cropped. */
export const ScaleMode = z.enum(['fit', 'fill']);
export type ScaleMode = z.infer<typeof ScaleMode>;

export const Canvas = z.object({
  width: Pixels,
  height: Pixels,
  scaleMode: ScaleMode,
  backgroundColor: Color,
});
export type Canvas = z.infer<typeof Canvas>;
