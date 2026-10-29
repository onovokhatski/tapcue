// What the player shows and how it changes: pure transitions for useReducer (spec ACT-3, ST-4).
import type { Hotspot, Page, PageId, Project, Station } from '@tapcue/shared';

export interface PlayerState {
  project: Project;
  station: Station;
  pageId: PageId;
}

export type PlayerAction =
  /** A hotspot was tapped. Its command is ignored until commands are sent (M2). */
  | { type: 'tap'; hotspot: Hotspot }
  /** No tap for the station's idle timeout. */
  | { type: 'idle' };

export function startPlayer({
  project,
  station,
}: {
  project: Project;
  station: Station;
}): PlayerState {
  return { project, station, pageId: station.startPageId };
}

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'tap':
      return goTo(state, action.hotspot.action.goTo);
    case 'idle':
      return goTo(state, state.station.startPageId);
  }
}

/** The page on screen. The station's start page exists: the server validated the project. */
export function currentPage(state: PlayerState): Page | undefined {
  return state.project.pages.find((page) => page.id === state.pageId);
}

// The same state object when nothing changes, so React skips the re-render.
function goTo(state: PlayerState, pageId: PageId | null): PlayerState {
  if (pageId === null || pageId === state.pageId) return state;
  // A link to a page that is not in the project keeps the visitor where they are.
  if (!state.project.pages.some((page) => page.id === pageId)) return state;
  return { ...state, pageId };
}
