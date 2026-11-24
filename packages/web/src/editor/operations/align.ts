// Aligning, distributing and sizing the selected hotspots (spec ED-18): buttons, no snapping
// guides. Several hotspots line up with the edges of their common box, one with the canvas. Every
// result is in whole canvas pixels and inside the canvas, and each is one change of the project.
import type { HotspotId, PageId, Project } from '@tapcue/shared';
import { boundingBox, type Rect, type Size } from './geometry';
import { boxesOf, placeHotspots } from './hotspots';

export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type Axis = 'horizontal' | 'vertical';
export type Dimension = 'width' | 'height' | 'both';

type Boxes = Record<HotspotId, Rect>;

/** Each box lined up with one edge, or the centre, of `frame`. */
export function alignBoxes(boxes: Boxes, alignment: Alignment, frame: Rect): Boxes {
  const place = (rect: Rect): Rect => {
    switch (alignment) {
      case 'left':
        return { ...rect, x: frame.x };
      case 'center':
        return { ...rect, x: Math.round(frame.x + (frame.width - rect.width) / 2) };
      case 'right':
        return { ...rect, x: frame.x + frame.width - rect.width };
      case 'top':
        return { ...rect, y: frame.y };
      case 'middle':
        return { ...rect, y: Math.round(frame.y + (frame.height - rect.height) / 2) };
      case 'bottom':
        return { ...rect, y: frame.y + frame.height - rect.height };
    }
  };
  return mapBoxes(boxes, place);
}

/**
 * The boxes spread along one axis with equal gaps between them, in the order they stand. The two
 * outermost stay where they are; boxes of different sizes keep their sizes, so the gaps, not the
 * positions, are equal. Fewer than three boxes have nothing to spread.
 */
export function distributeBoxes(boxes: Boxes, axis: Axis): Boxes {
  const entries = Object.entries(boxes);
  if (entries.length < 3) return boxes;
  const [pos, size] =
    axis === 'horizontal' ? (['x', 'width'] as const) : (['y', 'height'] as const);
  // In the order they stand; equal starts keep the order they came in.
  const order = [...entries].sort(([, a], [, b]) => a[pos] - b[pos]);
  const first = order[0]![1];
  const last = order.at(-1)![1];
  // The last one's exact place works out to where it stands, so it stays: first + every size but
  // its own + the gaps = its start.
  const span = last[pos] + last[size] - first[pos];
  const sizes = order.reduce((sum, [, rect]) => sum + rect[size], 0);
  const gap = (span - sizes) / (order.length - 1);
  const result: Boxes = { ...boxes };
  let start = first[pos];
  for (const [id, rect] of order) {
    // Rounded from the exact place, so rounding never adds up along the row.
    result[id] = { ...rect, [pos]: Math.round(start) };
    start += rect[size] + gap;
  }
  return result;
}

/**
 * Every box given the width, height or both of `model`; a box that would then reach past the
 * canvas edge moves back inside.
 */
export function sizeBoxes(boxes: Boxes, model: Rect, dimension: Dimension, canvas: Size): Boxes {
  return mapBoxes(boxes, (rect) => {
    const width = dimension === 'height' ? rect.width : model.width;
    const height = dimension === 'width' ? rect.height : model.height;
    return {
      x: Math.min(rect.x, canvas.width - width),
      y: Math.min(rect.y, canvas.height - height),
      width,
      height,
    };
  });
}

/**
 * Aligns the hotspots: several to their common box, one to the canvas (spec ED-18). The selection
 * is kept in page order, so `ids` comes as the page lists them.
 */
export function alignHotspots(
  project: Project,
  pageId: PageId,
  ids: HotspotId[],
  alignment: Alignment,
): Project {
  const boxes = boxesOf(project, pageId, ids);
  const list = Object.values(boxes);
  const { width, height } = project.canvas;
  const frame = list.length === 1 ? { x: 0, y: 0, width, height } : boundingBox(list);
  if (!frame) return project;
  return placeHotspots(project, pageId, alignBoxes(boxes, alignment, frame));
}

/** Spreads three or more hotspots with equal gaps along one axis (spec ED-18). */
export function distributeHotspots(
  project: Project,
  pageId: PageId,
  ids: HotspotId[],
  axis: Axis,
): Project {
  return placeHotspots(project, pageId, distributeBoxes(boxesOf(project, pageId, ids), axis));
}

/**
 * Gives the hotspots the width, height or both of the first of them in page order, the one the
 * panel lists first (spec ED-18).
 */
export function matchSize(
  project: Project,
  pageId: PageId,
  ids: HotspotId[],
  dimension: Dimension,
): Project {
  const boxes = boxesOf(project, pageId, ids);
  const page = project.pages.find((p) => p.id === pageId);
  const firstId = page?.hotspots.find((h) => ids.includes(h.id))?.id;
  const model = firstId ? boxes[firstId] : undefined;
  if (!model) return project;
  return placeHotspots(project, pageId, sizeBoxes(boxes, model, dimension, project.canvas));
}

function mapBoxes(boxes: Boxes, map: (rect: Rect) => Rect): Boxes {
  const result: Boxes = {};
  for (const [id, rect] of Object.entries(boxes)) result[id] = map(rect);
  return result;
}
