// Moving and resizing a hotspot's box in canvas pixels: whole pixels, never smaller than MIN_SIZE,
// never outside the canvas (spec HS-2, project format §10).

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The smallest box a resize leaves: still easy to grab and to tap. */
export const MIN_SIZE = 16;

/** The eight resize handles, named by the edges they move. */
export type Handle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

/** The box moved by (dx, dy), kept whole inside the canvas. */
export function moveRect(rect: Rect, dx: number, dy: number, canvas: Size): Rect {
  return {
    ...rect,
    x: clamp(Math.round(rect.x + dx), 0, canvas.width - rect.width),
    y: clamp(Math.round(rect.y + dy), 0, canvas.height - rect.height),
  };
}

/**
 * The box with the handle's edges moved by (dx, dy). The opposite edges stay put; an edge stops at
 * the canvas border and at MIN_SIZE from its opposite edge.
 */
export function resizeRect(rect: Rect, handle: Handle, dx: number, dy: number, canvas: Size): Rect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  if (handle.includes('w')) left = clamp(Math.round(left + dx), 0, right - MIN_SIZE);
  if (handle.includes('e')) right = clamp(Math.round(right + dx), left + MIN_SIZE, canvas.width);
  if (handle.includes('n')) top = clamp(Math.round(top + dy), 0, bottom - MIN_SIZE);
  if (handle.includes('s')) bottom = clamp(Math.round(bottom + dy), top + MIN_SIZE, canvas.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
