// Where a page of canvas size lands in a viewport: one scale factor and an offset (spec CNV-2, CNV-3).
import type { ScaleMode } from '@tapcue/shared';

export interface Size {
  width: number;
  height: number;
}

export interface StageGeometry {
  /** Canvas pixels → viewport pixels; the same for both axes, so the page never stretches. */
  scale: number;
  /** Top-left corner of the scaled page in viewport pixels; negative in `fill` when edges are cropped. */
  offsetX: number;
  offsetY: number;
  /** Canvas pixels hidden on each side (left and right, top and bottom); 0 in `fit` (spec ED-3). */
  cropX: number;
  cropY: number;
}

export function stageGeometry(canvas: Size, viewport: Size, mode: ScaleMode): StageGeometry {
  // Before layout the viewport can be empty: draw nothing rather than divide by zero.
  if (viewport.width <= 0 || viewport.height <= 0) {
    return { scale: 0, offsetX: 0, offsetY: 0, cropX: 0, cropY: 0 };
  }

  const scaleX = viewport.width / canvas.width;
  const scaleY = viewport.height / canvas.height;
  const scale = mode === 'fit' ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);

  // The part of the canvas the viewport shows, in canvas pixels; larger than the canvas in `fit`.
  const visibleWidth = viewport.width / scale;
  const visibleHeight = viewport.height / scale;

  return {
    scale,
    offsetX: (viewport.width - canvas.width * scale) / 2,
    offsetY: (viewport.height - canvas.height * scale) / 2,
    cropX: Math.max(0, (canvas.width - visibleWidth) / 2),
    cropY: Math.max(0, (canvas.height - visibleHeight) / 2),
  };
}
