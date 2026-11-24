// Hotspot operations: pure functions (project, args) => project, never changing their input
// (spec HS-1, HS-2, architecture §4.2). An operation that cannot apply returns the same project.
import {
  type Action,
  type AssetPath,
  type Command,
  type FaderSettings,
  firstCommand,
  type Hotspot,
  type HotspotId,
  type HotspotText,
  type PageId,
  type PressEffect,
  type Project,
  type Shape,
  type Style,
  VALUE_PLACEHOLDER,
} from '@tapcue/shared';
import { boundingBox, moveGroup, moveRect, type Rect } from './geometry';
import { freeName, nameProblem } from './hotspotNames';
import { newId } from './ids';

/** A new hotspot's share of the canvas: big enough to see and grab at any canvas size. */
const DEFAULT_SHARE = 0.2;

/**
 * Adds a hotspot in the centre of the page: a button, invisible and doing nothing yet, named
 * "Button N" with the lowest free N on the page (spec HS-1, ED-14, ADR 0012). Returns its id too.
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
  const { width: cw, height: ch } = project.canvas;
  const width = Math.round(cw * DEFAULT_SHARE);
  const height = Math.round(ch * DEFAULT_SHARE);
  const hotspot: Hotspot = {
    id: hotspotId,
    name: freeName(page, 'Button 1'),
    x: Math.round((cw - width) / 2),
    y: Math.round((ch - height) / 2),
    width,
    height,
    shape: { type: 'rect', cornerRadius: 0 },
    // Invisible, as most hotspots lie over a button drawn in the artwork.
    style: { fill: null, border: null, opacity: 1 },
    pressEffect: 'press',
    action: { goTo: null, commands: [] },
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

/**
 * Names are optional (the editor shows "Unnamed"), up to 100 characters after trimming, and not
 * one another hotspot on the page already has (spec ED-14; see nameProblem).
 */
export function renameHotspot(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  name: string,
): Project {
  const trimmed = name.trim();
  const page = project.pages.find((p) => p.id === pageId);
  const hotspot = page?.hotspots.find((h) => h.id === hotspotId);
  if (!page || !hotspot || trimmed.length > 100 || trimmed === hotspot.name) return project;
  if (nameProblem(page, hotspotId, trimmed)) return project;
  return updateHotspots(project, pageId, (hotspots) =>
    hotspots.map((h) => (h.id === hotspotId ? { ...h, name: trimmed } : h)),
  );
}

/** How far a duplicate lands from its original, right and down, in canvas pixels. */
export const DUPLICATE_OFFSET = 20;

/**
 * A copy with a new id, a free name ("Play" → "Play 2") and the same properties, a little to the
 * right and down but inside the canvas, just above the original in the stacking order (spec HS-7,
 * ED-14). Returns its id too.
 */
export function duplicateHotspot(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  random?: () => number,
): { project: Project; hotspotId: HotspotId | null } {
  const copied = duplicateHotspots(project, pageId, [hotspotId], random);
  return { project: copied.project, hotspotId: copied.hotspotIds[0] ?? null };
}

/** The boxes of these hotspots of the page, by id; ids not on the page are left out. */
export function boxesOf(
  project: Project,
  pageId: PageId,
  ids: HotspotId[],
): Record<HotspotId, Rect> {
  const boxes: Record<HotspotId, Rect> = {};
  for (const h of project.pages.find((p) => p.id === pageId)?.hotspots ?? []) {
    if (ids.includes(h.id)) boxes[h.id] = { x: h.x, y: h.y, width: h.width, height: h.height };
  }
  return boxes;
}

/** The common box of these hotspots of the page: where a group stands (spec ED-16). */
export function groupBox(project: Project, pageId: PageId, ids: HotspotId[]): Rect | null {
  return boundingBox(Object.values(boxesOf(project, pageId, ids)));
}

/** Puts each hotspot where `rects` says, in one change; the caller keeps them inside the canvas. */
export function placeHotspots(
  project: Project,
  pageId: PageId,
  rects: Record<HotspotId, Rect>,
): Project {
  return Object.entries(rects).reduce(
    (next, [id, rect]) => placeHotspot(next, pageId, id, rect),
    project,
  );
}

/**
 * Moves hotspots together by (dx, dy) canvas pixels from where they are now; the group stops as a
 * whole at the canvas edge (spec ED-16). One hotspot moves as nudgeHotspot moves it.
 */
export function nudgeHotspots(
  project: Project,
  pageId: PageId,
  ids: HotspotId[],
  dx: number,
  dy: number,
): Project {
  const boxes = boxesOf(project, pageId, ids);
  return placeHotspots(project, pageId, moveGroup(boxes, dx, dy, project.canvas));
}

/** Deletes hotspots of a page in one change. */
export function deleteHotspots(project: Project, pageId: PageId, ids: HotspotId[]): Project {
  const page = project.pages.find((p) => p.id === pageId);
  if (!page?.hotspots.some((h) => ids.includes(h.id))) return project;
  return updateHotspots(project, pageId, (hotspots) => hotspots.filter((h) => !ids.includes(h.id)));
}

/**
 * Copies hotspots in one change: each copy with a new id and a free name, just above its original,
 * and all of them moved together a little to the right and down, inside the canvas (spec HS-7,
 * ED-14, ED-16). Returns the copies' ids, in page order.
 */
export function duplicateHotspots(
  project: Project,
  pageId: PageId,
  ids: HotspotId[],
  random?: () => number,
): { project: Project; hotspotIds: HotspotId[] } {
  const page = project.pages.find((p) => p.id === pageId);
  if (!page) return { project, hotspotIds: [] };
  const originals = page.hotspots.filter((h) => ids.includes(h.id));
  const moved = moveGroup(
    boxesOf(project, pageId, ids),
    DUPLICATE_OFFSET,
    DUPLICATE_OFFSET,
    project.canvas,
  );
  const copies = makeCopies(project, page, originals, (h) => moved[h.id]!, random);
  const copyOf = new Map(originals.map((h, i) => [h.id, copies[i]!]));
  return {
    project: updateHotspots(project, pageId, (hotspots) =>
      hotspots.flatMap((h) => {
        const copy = copyOf.get(h.id);
        return copy ? [h, copy] : [h];
      }),
    ),
    hotspotIds: copies.map((c) => c.id),
  };
}

/** How far hotspots pasted on the page they were copied from land, right and down (spec ED-17). */
export const PASTE_OFFSET = 24;

/**
 * Pastes copied hotspots onto a page of the project (spec ED-17): on top of the others, at the
 * same positions, or 24 px right and down on the page they were copied from, so the copies show;
 * moved together, inside the canvas; with new ids and free names (ED-14). A link to the page they
 * land on, or to a page deleted since, becomes "stay"; commands to a target deleted since are
 * dropped, so the project stays valid. Returns the copies' ids.
 */
export function pasteHotspots(
  project: Project,
  pageId: PageId,
  copied: { pageId: PageId; hotspots: Hotspot[] },
  random?: () => number,
): { project: Project; hotspotIds: HotspotId[] } {
  const page = project.pages.find((p) => p.id === pageId);
  if (!page || copied.hotspots.length === 0) return { project, hotspotIds: [] };
  const offset = copied.pageId === pageId ? PASTE_OFFSET : 0;
  const boxes: Record<string, Rect> = {};
  copied.hotspots.forEach(({ x, y, width, height }, i) => (boxes[i] = { x, y, width, height }));
  const moved = moveGroup(boxes, offset, offset, project.canvas);
  const targets = new Set(project.targets.map((t) => t.id));
  const pages = new Set(project.pages.map((p) => p.id));
  const fitted = copied.hotspots.map((hotspot): Hotspot => {
    const { goTo, commands } = hotspot.action;
    const stay = goTo === null || goTo === pageId || !pages.has(goTo);
    return {
      ...hotspot,
      action: {
        goTo: stay ? null : goTo,
        commands: commands.filter((step) => targets.has(step.command.targetId)),
      },
    };
  });
  const copies = makeCopies(project, page, fitted, (_, i) => moved[i]!, random);
  return {
    project: updateHotspots(project, pageId, (hotspots) => [...hotspots, ...copies]),
    hotspotIds: copies.map((c) => c.id),
  };
}

/**
 * Copies of `originals` for `page`, each at the box `boxOf` gives it, with an id not used on any
 * page and a name free on the page, also among the copies themselves.
 */
function makeCopies(
  project: Project,
  page: Project['pages'][number],
  originals: Hotspot[],
  boxOf: (original: Hotspot, index: number) => Rect,
  random?: () => number,
): Hotspot[] {
  const taken = project.pages.flatMap((p) => p.hotspots.map((h) => h.id));
  const copies: Hotspot[] = [];
  let named = page;
  for (const [index, original] of originals.entries()) {
    const id = newId('h', taken, random);
    taken.push(id);
    const copy: Hotspot = {
      ...structuredClone(original),
      ...boxOf(original, index),
      id,
      name: freeName(named, original.name),
    };
    // Later copies must not take a name an earlier copy got.
    named = { ...named, hotspots: [...named.hotspots, copy] };
    copies.push(copy);
  }
  return copies;
}

/** Deletes a hotspot. Nothing else refers to hotspots, so nothing else changes. */
export function deleteHotspot(project: Project, pageId: PageId, hotspotId: HotspotId): Project {
  return deleteHotspots(project, pageId, [hotspotId]);
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

/** Sets the shape: rectangle with its corner radius, or ellipse (spec HS-3). The box stays. */
export function setShape(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  shape: Shape,
): Project {
  return updateHotspot(project, pageId, hotspotId, (h) =>
    JSON.stringify(h.shape) === JSON.stringify(shape) ? h : { ...h, shape },
  );
}

/** Changes part of the style: fill, border, opacity (spec HS-4). */
export function setStyle(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  change: Partial<Style>,
): Project {
  return updateHotspot(project, pageId, hotspotId, (h) => {
    const style = { ...h.style, ...change };
    // No frost is stored as no field, the way projects from before v0.2 have it (ADR 0019).
    if (style.backdropBlur === 0) delete style.backdropBlur;
    // A solid fill, likewise: 100 % is no field.
    if (style.fillOpacity === 1) delete style.fillOpacity;
    return JSON.stringify(style) === JSON.stringify(h.style) ? h : { ...h, style };
  });
}

/** Sets or removes the hotspot's image (spec HS-9). None is stored as no field (ADR 0019). */
export function setHotspotImage(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  image: AssetPath | null,
): Project {
  return updateHotspot(project, pageId, hotspotId, (h) => {
    if ((h.style.image ?? null) === image) return h;
    const { image: _, ...rest } = h.style;
    return { ...h, style: image ? { ...rest, image } : rest };
  });
}

/** A new label: centred, white, medium, sized for a button on a 2048-wide canvas (spec HS-10). */
export const DEFAULT_TEXT: HotspotText = {
  content: 'Label',
  size: 48,
  weight: 'medium',
  color: '#FFFFFF',
  align: 'center',
  verticalAlign: 'middle',
  padding: 24,
};

/**
 * Adds or changes the hotspot's text (spec HS-10): a change applies to its text, or to a new
 * default one; null removes it, stored as no field (ADR 0019).
 */
export function setHotspotText(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  change: Partial<HotspotText> | null,
): Project {
  return updateHotspot(project, pageId, hotspotId, (h) => {
    if (change === null) {
      if (!h.text) return h;
      const { text: _, ...rest } = h;
      return rest;
    }
    const text = { ...(h.text ?? DEFAULT_TEXT), ...change };
    return JSON.stringify(text) === JSON.stringify(h.text) ? h : { ...h, text };
  });
}

/**
 * Makes the hotspot a button or a fader (ADR 0020). A new fader starts from 0 to 1 by 0.01 at 0,
 * vertical when its box is taller than wide, with the value as the last OSC argument; it changes
 * no page and has no press effect, and a command of another protocol is cleared, since a fader
 * sends OSC for now. A button loses the fader settings and gets the press-in effect back. A name
 * the editor gave ("Button 3") follows the kind ("Fader 1"); one the integrator gave stays.
 */
export function setKind(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  kind: 'button' | 'fader',
): Project {
  const page = project.pages.find((p) => p.id === pageId);
  return updateHotspot(project, pageId, hotspotId, (h) => {
    const current = h.kind === 'fader' ? 'fader' : 'button';
    if (current === kind || !page) return h;
    const { kind: _kind, fader: _fader, ...withoutFader } = h;
    const rest = { ...withoutFader, name: kindName(page, h, current, kind) };
    if (kind === 'button') return { ...rest, pressEffect: 'press' };
    // A fader sends one command, at once (ADR 0022): the first one, with a place for the value.
    const first = firstCommand(h.action);
    const command = first && withPlaceholder(first);
    const fader: FaderSettings = {
      orientation: h.height > h.width ? 'vertical' : 'horizontal',
      min: 0,
      max: 1,
      step: 0.01,
      start: 0,
      value: { at: command?.type === 'osc-udp' ? command.args.length : 0, as: 'f' },
    };
    const commands = command ? [{ command }] : [];
    return { ...rest, kind, fader, pressEffect: 'none', action: { goTo: null, commands } };
  });
}

const KIND_NAME = { button: 'Button', fader: 'Fader' } as const;

/** "Button 3" becomes the lowest free "Fader N" when the hotspot becomes a fader, and back. */
function kindName(
  page: Project['pages'][number],
  hotspot: Hotspot,
  from: 'button' | 'fader',
  to: 'button' | 'fader',
): string {
  const given = new RegExp(`^${KIND_NAME[from]} \\d+$`, 'i').test(hotspot.name.trim());
  // Its own "Button N" never clashes with a "Fader N", so the page can be searched as it is.
  return given ? freeName(page, `${KIND_NAME[to]} 1`) : hotspot.name;
}

/**
 * A command with a place for a fader's value (ADR 0020): UDP text or an HTTP path and body without
 * {value} get it at the end of the text or the path. OSC needs none: the value is an argument.
 */
export function withPlaceholder(command: Command): Command {
  switch (command.type) {
    case 'osc-udp':
      return command;
    case 'udp':
      return command.text.includes(VALUE_PLACEHOLDER)
        ? command
        : { ...command, text: `${command.text} ${VALUE_PLACEHOLDER}` };
    case 'http':
      return command.path.includes(VALUE_PLACEHOLDER) ||
        (command.body ?? '').includes(VALUE_PLACEHOLDER)
        ? command
        : { ...command, path: `${command.path.replace(/\/$/, '')}/${VALUE_PLACEHOLDER}` };
  }
}

/** Changes part of a fader's settings (spec FD-1); a hotspot that is not a fader is left alone. */
export function setFader(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  change: Partial<FaderSettings>,
): Project {
  return updateHotspot(project, pageId, hotspotId, (h) => {
    if (h.kind !== 'fader' || !h.fader) return h;
    const fader = { ...h.fader, ...change };
    return JSON.stringify(fader) === JSON.stringify(h.fader) ? h : { ...h, fader };
  });
}

/** Sets what a press looks like: none, highlight, press-in or ripple (spec HS-5). */
export function setPressEffect(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  pressEffect: PressEffect,
): Project {
  return updateHotspot(project, pageId, hotspotId, (h) =>
    h.pressEffect === pressEffect ? h : { ...h, pressEffect },
  );
}

/** Changes a hotspot's action (go to page, command); see operations/actions.ts. */
export function setAction(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  update: (action: Action) => Action,
): Project {
  return updateHotspot(project, pageId, hotspotId, (h) => {
    const action = update(h.action);
    if (JSON.stringify(action) === JSON.stringify(h.action)) return h;
    // A fader's value position stays within its OSC arguments, also when one is removed.
    const command = firstCommand(action);
    if (h.fader && command?.type === 'osc-udp' && h.fader.value.at > command.args.length) {
      const value = { ...h.fader.value, at: command.args.length };
      return { ...h, action, fader: { ...h.fader, value } };
    }
    return { ...h, action };
  });
}

/**
 * Applies `operation` to each of these hotspots of the page in turn, as one change: how a setting
 * is given to several at once (spec ED-19). Each call gets the hotspot as it was before.
 */
export function forEachHotspot(
  project: Project,
  pageId: PageId,
  ids: HotspotId[],
  operation: (project: Project, hotspot: Hotspot) => Project,
): Project {
  const page = project.pages.find((p) => p.id === pageId);
  const hotspots = page?.hotspots.filter((h) => ids.includes(h.id)) ?? [];
  return hotspots.reduce(operation, project);
}

/** Applies a change to one hotspot; the same project when the hotspot is missing or unchanged. */
function updateHotspot(
  project: Project,
  pageId: PageId,
  hotspotId: HotspotId,
  update: (hotspot: Hotspot) => Hotspot,
): Project {
  const hotspot = findHotspot(project, pageId, hotspotId);
  if (!hotspot) return project;
  const next = update(hotspot);
  if (next === hotspot) return project;
  return updateHotspots(project, pageId, (hotspots) =>
    hotspots.map((h) => (h.id === hotspotId ? next : h)),
  );
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
