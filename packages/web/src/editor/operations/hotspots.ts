// Hotspot operations: pure functions (project, args) => project, never changing their input
// (spec HS-1, HS-2, architecture §4.2). An operation that cannot apply returns the same project.
import type { Hotspot, HotspotId, PageId, Project } from '@tapcue/shared';
import { moveRect, type Rect } from './geometry';
import { newId } from './ids';

/** A new hotspot's share of the canvas: big enough to see and grab at any canvas size. */
const DEFAULT_SHARE = 0.2;

/**
 * Adds a hotspot in the centre of the page, invisible and doing nothing yet, named "Hotspot N"
 * with the first free N (spec HS-1, ADR 0012). Returns its id too.
 */
export function addHotspot(
  project: Project,
  pageId: PageId,
  random?: () => number,
): { project: Project; hotspotId: HotspotId | null } {
  const page = project.pages.find((p) => p.id === pageId);
  if (!page) return { project, hotspotId: null };
  const all = project.pages.flatMap((p) => p.hotspots);
  const hotspotId = newId(
    'h',
    all.map((h) => h.id),
    random,
  );
  const names = new Set(page.hotspots.map((h) => h.name));
  let n = page.hotspots.length + 1;
  while (names.has(`Hotspot ${n}`)) n++;
  const { width: cw, height: ch } = project.canvas;
  const width = Math.round(cw * DEFAULT_SHARE);
  const height = Math.round(ch * DEFAULT_SHARE);
  const hotspot: Hotspot = {
    id: hotspotId,
    name: `Hotspot ${n}`,
    x: Math.round((cw - width) / 2),
    y: Math.round((ch - height) / 2),
    width,
    height,
    shape: { type: 'rect', cornerRadius: 0 },
    // Invisible, as most hotspots lie over a button drawn in the artwork.
    style: { fill: null, border: null, opacity: 1 },
    pressEffect: 'press',
    action: { goTo: null, command: null },
  };
  return {
    project: updatePage(project, pageId, (p) => ({ ...p, hotspots: [...p.hotspots, hotspot] })),
    hotspotId,
  };
}

/** Puts a hotspot's box where `rect` says; the caller keeps it whole and inside the canvas. */
export function placeHotspot(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  rect: Rect,
): Project {
  const page = project.pages.find((p) => p.id === pageId);
  const hotspot = page?.hotspots.find((h) => h.id === hotspotId);
  if (!hotspot) return project;
  const same =
    hotspot.x === rect.x &&
    hotspot.y === rect.y &&
    hotspot.width === rect.width &&
    hotspot.height === rect.height;
  if (same) return project;
  return updatePage(project, pageId, (p) => ({
    ...p,
    hotspots: p.hotspots.map((h) => (h.id === hotspotId ? { ...h, ...rect } : h)),
  }));
}

/** Moves a hotspot by (dx, dy) canvas pixels from where it is now, kept inside the canvas. */
export function nudgeHotspot(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  dx: number,
  dy: number,
): Project {
  const hotspot = project.pages
    .find((p) => p.id === pageId)
    ?.hotspots.find((h) => h.id === hotspotId);
  if (!hotspot) return project;
  return placeHotspot(project, pageId, hotspotId, moveRect(hotspot, dx, dy, project.canvas));
}

/** Names are optional (the editor shows "Unnamed"), up to 100 characters after trimming. */
export function renameHotspot(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  name: string,
): Project {
  const trimmed = name.trim();
  const hotspot = findHotspot(project, pageId, hotspotId);
  if (!hotspot || trimmed.length > 100 || trimmed === hotspot.name) return project;
  return updateHotspots(project, pageId, (hotspots) =>
    hotspots.map((h) => (h.id === hotspotId ? { ...h, name: trimmed } : h)),
  );
}

/** How far a duplicate lands from its original, right and down, in canvas pixels. */
export const DUPLICATE_OFFSET = 20;

/**
 * A copy with a new id and the same properties, a little to the right and down but inside the
 * canvas, just above the original in the stacking order (spec HS-7). Returns its id too.
 */
export function duplicateHotspot(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  random?: () => number,
): { project: Project; hotspotId: HotspotId | null } {
  const original = findHotspot(project, pageId, hotspotId);
  if (!original) return { project, hotspotId: null };
  const id = newId(
    'h',
    project.pages.flatMap((p) => p.hotspots.map((h) => h.id)),
    random,
  );
  const { x, y, width, height } = original;
  const copy: Hotspot = {
    ...structuredClone(original),
    ...moveRect({ x, y, width, height }, DUPLICATE_OFFSET, DUPLICATE_OFFSET, project.canvas),
    id,
  };
  return {
    project: updateHotspots(project, pageId, (hotspots) => {
      const index = hotspots.findIndex((h) => h.id === hotspotId);
      return [...hotspots.slice(0, index + 1), copy, ...hotspots.slice(index + 1)];
    }),
    hotspotId: id,
  };
}

/** Deletes a hotspot. Nothing else refers to hotspots, so nothing else changes. */
export function deleteHotspot(project: Project, pageId: PageId, hotspotId: HotspotId): Project {
  if (!findHotspot(project, pageId, hotspotId)) return project;
  return updateHotspots(project, pageId, (hotspots) => hotspots.filter((h) => h.id !== hotspotId));
}

/**
 * Moves a hotspot one step up or down the stacking order (spec HS-6). The list order is the
 * drawing order: the last hotspot lies on top and gets the tap where hotspots overlap.
 */
export function restackHotspot(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  direction: 'forward' | 'backward',
): Project {
  const hotspots = project.pages.find((p) => p.id === pageId)?.hotspots ?? [];
  const from = hotspots.findIndex((h) => h.id === hotspotId);
  const to = from + (direction === 'forward' ? 1 : -1);
  if (from === -1 || to < 0 || to >= hotspots.length) return project;
  return updateHotspots(project, pageId, (list) => {
    const next = [...list];
    [next[from], next[to]] = [next[to]!, next[from]!];
    return next;
  });
}

function findHotspot(project: Project, pageId: PageId, hotspotId: HotspotId) {
  return project.pages.find((p) => p.id === pageId)?.hotspots.find((h) => h.id === hotspotId);
}

function updateHotspots(
  project: Project,
  pageId: PageId,
  update: (hotspots: Hotspot[]) => Hotspot[],
): Project {
  return updatePage(project, pageId, (page) => ({ ...page, hotspots: update(page.hotspots) }));
}

function updatePage(
  project: Project,
  pageId: PageId,
  update: (page: Project['pages'][number]) => Project['pages'][number],
): Project {
  return { ...project, pages: project.pages.map((p) => (p.id === pageId ? update(p) : p)) };
}
