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

function updatePage(
  project: Project,
  pageId: PageId,
  update: (page: Project['pages'][number]) => Project['pages'][number],
): Project {
  return { ...project, pages: project.pages.map((p) => (p.id === pageId ? update(p) : p)) };
}
