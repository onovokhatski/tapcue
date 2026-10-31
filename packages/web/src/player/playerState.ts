// Where the visitor is and what is on screen: pure transitions for useReducer
// (spec ACT-3, ST-4, PG-4, PG-5, PLY-5, PLY-6, ADR 0014).
import type { Hotspot, Page, PageId, Project, Station } from '@tapcue/shared';

export interface PlayerState {
  project: Project;
  station: Station;
  /** The page the visitor is on: the latest navigation, even while it is still fading in. */
  pageId: PageId;
  /** The page fully on screen. Differs from pageId while the next page waits or fades in on top. */
  shown: PageId;
  /** pageId's background is ready and it is fading in over `shown`. */
  fading: boolean;
}

export type PlayerAction =
  /** A hotspot was tapped. Its command is ignored until commands are sent (M2). */
  | { type: 'tap'; hotspot: Hotspot }
  /** No tap for the station's idle timeout. */
  | { type: 'idle' }
  /** A page's background has its first frame: it can fade in without a blank frame. */
  | { type: 'ready'; pageId: PageId }
  /** A page finished fading in. */
  | { type: 'faded'; pageId: PageId }
  /** The project was saved in the editor; the player carries on with the new one. */
  | { type: 'project'; project: Project; station: Station };

export function startPlayer({
  project,
  station,
}: {
  project: Project;
  station: Station;
}): PlayerState {
  const pageId = station.startPageId;
  return { project, station, pageId, shown: pageId, fading: false };
}

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'tap':
      return goTo(state, action.hotspot.action.goTo);
    case 'idle':
      return goTo(state, state.station.startPageId);
    case 'ready':
      if (action.pageId !== incoming(state) || state.fading) return state;
      return { ...state, fading: true };
    case 'faded':
      if (action.pageId !== incoming(state) || !state.fading) return state;
      return { ...state, shown: state.pageId, fading: false };
    case 'project':
      return applyProject(state, action.project, action.station);
  }
}

/** The page the visitor is on. The station's start page exists: the server validated the project. */
export function currentPage(state: PlayerState): Page | undefined {
  return state.project.pages.find((page) => page.id === state.pageId);
}

/** The page on its way onto the screen, waiting for its background or fading in; null when none. */
export function incoming(state: PlayerState): PageId | null {
  return state.pageId === state.shown ? null : state.pageId;
}

/**
 * The visitor stays where they are when that page still exists; otherwise back to the start page,
 * at once: the deleted page cannot stay on screen while the start page loads (spec PLY-6).
 */
function applyProject(state: PlayerState, project: Project, station: Station): PlayerState {
  const exists = (pageId: PageId) => project.pages.some((page) => page.id === pageId);
  if (!exists(state.pageId)) {
    const start = station.startPageId;
    return { project, station, pageId: start, shown: start, fading: false };
  }
  // The page under a fade was deleted: the incoming page takes its place.
  if (!exists(state.shown))
    return { ...state, project, station, shown: state.pageId, fading: false };
  return { ...state, project, station };
}

// The same state object when nothing changes, so React skips the re-render.
function goTo(state: PlayerState, pageId: PageId | null): PlayerState {
  if (pageId === null || pageId === state.pageId) return state;
  // A link to a page that is not in the project keeps the visitor where they are.
  if (!state.project.pages.some((page) => page.id === pageId)) return state;
  // A tap during a fade comes from the page fading in: it becomes the shown page at once,
  // and the new page fades in over it. A page still waiting for its background is dropped.
  const shown = state.fading ? state.pageId : state.shown;
  return { ...state, pageId, shown, fading: false };
}
