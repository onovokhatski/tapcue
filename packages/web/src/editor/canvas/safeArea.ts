// What `fill` mode crops on a reference screen, and how far a hotspot reaches into it (spec ED-3).
// The same stageGeometry as the player, so the editor's warning matches what a tablet shows.
import type { Canvas, Hotspot } from '@tapcue/shared';
import { stageGeometry } from '../../stage/geometry';

export const REFERENCE_SCREENS = {
  '16:10': { label: '16:10 · 1280 × 800', width: 1280, height: 800 },
  '16:9': { label: '16:9 · 1920 × 1080', width: 1920, height: 1080 },
} as const;

export type ReferenceScreen = keyof typeof REFERENCE_SCREENS;

/** Canvas pixels cropped at each edge: `side` from left and right, `top` from top and bottom. */
export interface CropBands {
  side: number;
  top: number;
}

export function cropBands(canvas: Canvas, reference: ReferenceScreen): CropBands {
  if (canvas.scaleMode !== 'fill') return { side: 0, top: 0 };
  const { cropX, cropY } = stageGeometry(canvas, REFERENCE_SCREENS[reference], 'fill');
  return { side: Math.round(cropX), top: Math.round(cropY) };
}

export type Edge = 'top' | 'bottom' | 'left' | 'right';

/** How many canvas pixels of a hotspot are cropped, at its worst edge; null when none. */
export function croppedBy(
  hotspot: Pick<Hotspot, 'x' | 'y' | 'width' | 'height'>,
  canvas: Canvas,
  reference: ReferenceScreen,
): { pixels: number; edge: Edge } | null {
  const bands = cropBands(canvas, reference);
  const cuts: [number, Edge][] = [
    [bands.top - hotspot.y, 'top'],
    [hotspot.y + hotspot.height - (canvas.height - bands.top), 'bottom'],
    [bands.side - hotspot.x, 'left'],
    [hotspot.x + hotspot.width - (canvas.width - bands.side), 'right'],
  ];
  const [pixels, edge] = cuts.reduce((worst, cut) => (cut[0] > worst[0] ? cut : worst));
  return pixels > 0 ? { pixels, edge } : null;
}
