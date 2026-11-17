// Pages and the hotspots on them (docs/project-format.md §4, §5, §7).
import { z } from 'zod';
import { Command } from './targets';
import { AssetPath, Color, HotspotId, Name, PageId } from './values';

/** Canvas pixels. Positions may be fractional after scaling; staying inside the canvas is checked across the project. */
const Coordinate = z.number('Expected a number').min(0, 'Expected 0 or more');
const Length = z.number('Expected a number').min(1, 'Expected at least 1 px');

export const Shape = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('rect'),
    cornerRadius: z.number().min(0, 'Expected 0 or more'),
  }),
  // The ellipse fills the hotspot's box, so it needs no extra fields.
  z.strictObject({ type: z.literal('ellipse') }),
]);
export type Shape = z.infer<typeof Shape>;

/** fill and border null both: an invisible hotspot, the usual case when the button is drawn on the background. */
export const Style = z.strictObject({
  fill: Color.nullable(),
  border: z
    .strictObject({
      color: Color,
      width: z.number().min(1, 'Expected at least 1 px').max(100, 'Expected at most 100 px'),
    })
    .nullable(),
  opacity: z.number().min(0, 'Expected 0 to 1').max(1, 'Expected 0 to 1'),
  // Frosted backdrop (spec HS-8, ADR 0019): blurs what lies under the hotspot, radius in canvas
  // pixels. Absent means none, so projects from before v0.2 stay valid.
  backdropBlur: z
    .number('Expected a number')
    .min(1, 'Expected 1 to 100 px')
    .max(100, 'Expected 1 to 100 px')
    .optional(),
  // Image (spec HS-9, ADR 0019): covers the hotspot's box, cropped, above the fill. Absent means
  // none. That the file exists is checked by the server, which sees the disk.
  image: AssetPath.optional(),
});
export type Style = z.infer<typeof Style>;

/**
 * A text label drawn on the hotspot (spec HS-10, ADR 0019), above the image and below the border.
 * Sizes are canvas pixels; the font is the device's system sans-serif.
 */
export const HotspotText = z.strictObject({
  // Line breaks are kept; a label with no visible text is no label, so it is removed instead.
  content: z.string().min(1, 'Expected some text').max(500, 'Expected at most 500 characters'),
  size: z
    .number('Expected a number')
    .min(8, 'Expected 8 to 400 px')
    .max(400, 'Expected 8 to 400 px'),
  weight: z.enum(['regular', 'medium', 'bold']),
  color: Color,
  align: z.enum(['left', 'center', 'right']),
  verticalAlign: z.enum(['top', 'middle', 'bottom']),
  padding: z
    .number('Expected a number')
    .min(0, 'Expected 0 to 500 px')
    .max(500, 'Expected 0 to 500 px'),
});
export type HotspotText = z.infer<typeof HotspotText>;

export const PressEffect = z.enum(['none', 'highlight', 'press', 'ripple']);
export type PressEffect = z.infer<typeof PressEffect>;

/** What a tap does. Both null is allowed: a hotspot that only plays its press effect. */
export const Action = z.strictObject({
  goTo: PageId.nullable(),
  command: Command.nullable(),
});
export type Action = z.infer<typeof Action>;

export const Hotspot = z.strictObject({
  id: HotspotId,
  // Optional label for the editor and the command log, so an empty name is allowed.
  name: z.string().max(100, 'Expected at most 100 characters'),
  x: Coordinate,
  y: Coordinate,
  width: Length,
  height: Length,
  shape: Shape,
  style: Style,
  // Absent means no text, so projects from before v0.2 stay valid.
  text: HotspotText.optional(),
  pressEffect: PressEffect,
  action: Action,
});
export type Hotspot = z.infer<typeof Hotspot>;

/** Video backgrounds always play muted and looped (spec PG-3). */
export const Background = z.strictObject({
  type: z.enum(['image', 'video']),
  asset: AssetPath,
});
export type Background = z.infer<typeof Background>;

export const Page = z.strictObject({
  id: PageId,
  name: Name,
  background: Background.nullable(),
  // Array order is stacking order: later hotspots are drawn on top.
  hotspots: z.array(Hotspot),
});
export type Page = z.infer<typeof Page>;
