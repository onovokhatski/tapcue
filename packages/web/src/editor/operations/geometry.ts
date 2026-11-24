// Moving and resizing a hotspot's box in canvas pixels: whole pixels, never smaller than MIN_SIZE,
// never outside the canvas (spec HS-2, project format §10). Several boxes move as one group, which
// stops as a whole at the canvas edge (spec ED-16).

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

/** The box moved by (dx, dy), kept whole inside the canvas. Only the box: x, y, width, height. */
export function moveRect(rect: Rect, dx: number, dy: number, canvas: Size): Rect {
  return {
    x: clamp(Math.round(rect.x + dx), 0, canvas.width - rect.width),
    y: clamp(Math.round(rect.y + dy), 0, canvas.height - rect.height),
    width: rect.width,
    height: rect.height,
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

/** The smallest box around all of `rects`; null for none. */
export function boundingBox(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The boxes moved together by (dx, dy), whole pixels. The move is cut short so their common box
 * stays inside the canvas: the group keeps its shape at an edge instead of piling up there.
 */
export function moveGroup<K extends string>(
  rects: Record<K, Rect>,
  dx: number,
  dy: number,
  canvas: Size,
): Record<K, Rect> {
  const box = boundingBox(Object.values<Rect>(rects));
  if (!box) return rects; // no boxes: nothing to move
  const moved = moveRect(box, dx, dy, canvas);
  const [mx, my] = [moved.x - box.x, moved.y - box.y];
  const result = {} as Record<K, Rect>;
  for (const [id, rect] of Object.entries<Rect>(rects)) {
    result[id as K] = { ...rect, x: rect.x + mx, y: rect.y + my };
  }
  return result;
}

/** Whether two boxes overlap; boxes that only touch do not. */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The box between two corners, in any order: what a selection rectangle covers. */
export function rectBetween(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type BoxKey = keyof Rect;

/**
 * Why a value typed into one of a hotspot's X, Y, W or H fields cannot be used, or null. Whole
 * pixels only, and the box must stay inside the canvas with the other three values as they are.
 */
/** The values a box field may take while the box stays inside the canvas. */
export function boxFieldLimits(key: BoxKey, box: Rect, canvas: Size): { min: number; max: number } {
  const max = {
    x: canvas.width - box.width,
    y: canvas.height - box.height,
    width: canvas.width - box.x,
    height: canvas.height - box.y,
  }[key];
  return { min: key === 'width' || key === 'height' ? 1 : 0, max };
}

export function checkBoxField(key: BoxKey, text: string, box: Rect, canvas: Size): string | null {
  if (!/^\d+$/.test(text.trim())) return 'expected a whole number';
  const value = Number(text);
  const { min, max } = boxFieldLimits(key, box, canvas);
  if (value < min || value > max) return `${min} to ${max}, to stay inside the canvas`;
  return null;
}
