// The canvas on a reference screen in one scale mode (components.md: Scale diagram; prototype
// scaleDiagram()). Fit: the page inside a dark screen, with bars. Fill: the page larger than the
// screen; the pale dashed parts fall outside it and are cropped. Computed with the player's
// stageGeometry, so it shows what a tablet shows.
import type { Canvas, ScaleMode } from '@tapcue/shared';
import { cropBands, REFERENCE_SCREENS, type ReferenceScreen } from '../canvas/safeArea';
import { stageGeometry } from '../../stage/geometry';

/** The drawing area of one diagram, in CSS pixels. */
const BOX = { width: 150, height: 112 };

export function ScaleDiagram({
  canvas,
  mode,
  reference,
}: {
  canvas: Canvas;
  mode: ScaleMode;
  reference: ReferenceScreen;
}) {
  const screen = REFERENCE_SCREENS[reference];
  const { scale } = stageGeometry(canvas, screen, mode);
  // Screen and page in screen pixels, then all of it shrunk to fit the box.
  const page = { width: canvas.width * scale, height: canvas.height * scale };
  const outer = {
    width: Math.max(screen.width, page.width),
    height: Math.max(screen.height, page.height),
  };
  const k = Math.min(BOX.width / outer.width, BOX.height / outer.height);
  const size = (s: { width: number; height: number }) => ({
    width: Math.round(s.width * k),
    height: Math.round(s.height * k),
  });

  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center" style={BOX}>
        {mode === 'fit' ? (
          <div
            className="flex items-center justify-center rounded-sm bg-inverse"
            style={size(screen)}
          >
            <div
              className="flex items-center justify-center bg-accent text-label-s text-on-accent"
              style={size(page)}
            >
              Page
            </div>
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded-sm border border-dashed border-strong bg-accent-subtle"
            style={size(page)}
          >
            <div
              className="flex flex-none items-center justify-center bg-accent text-label-s text-on-accent outline-2 outline-[color:var(--color-bg-inverse)]"
              style={size(screen)}
            >
              Page
            </div>
          </div>
        )}
      </div>
      <figcaption className="text-center">
        <span className="block text-label-s">{screen.label}</span>
        <span className="block text-body-s text-muted tabular-nums">
          {caption(canvas, mode, reference)}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Bars are on the screen, so they are in screen pixels. Crops are in canvas pixels, the same numbers
 * as the safe area on the Pages tab.
 */
export function caption(canvas: Canvas, mode: ScaleMode, reference: ReferenceScreen): string {
  if (mode === 'fill') {
    const { side, top } = cropBands({ ...canvas, scaleMode: 'fill' }, reference);
    if (top > 0) return `${top} px cropped top and bottom`;
    if (side > 0) return `${side} px cropped left and right`;
    return 'Nothing cropped';
  }
  const { offsetX, offsetY } = stageGeometry(canvas, REFERENCE_SCREENS[reference], 'fit');
  if (Math.round(offsetX) > 0) return `${Math.round(offsetX)} px bars left and right`;
  if (Math.round(offsetY) > 0) return `${Math.round(offsetY)} px bars top and bottom`;
  return 'No bars';
}
