// What the demo receiver page shows: requests newest first, and one tile per screen with the
// content it last received (spec DEMO-1); a fader's values in a row update one request instead of
// adding one each, and a later step of a sequence says how long after the step before it came
// (ADR 0022). Pure transitions for useReducer.
import type { DemoRequest } from '@tapcue/shared';

/** Enough to scroll back through a demo; older rows are dropped so a long session stays light. */
export const REQUEST_LIMIT = 200;

export interface Received {
  /** Numbers requests in the order they arrived, for React keys and the "new" highlight. */
  id: number;
  request: DemoRequest;
  /** For a later step of a sequence: milliseconds since the step before it of the same tap. */
  sinceMs?: number;
}

export interface Screen {
  name: string;
  /** The request that set what the screen shows now. */
  last: Received;
}

export interface DemoState {
  requests: Received[];
  /** Sorted by name, numbers in order: screen-2 before screen-10. */
  screens: Screen[];
  /** The newest request while it is highlighted as new; null once it settles. */
  freshId: number | null;
  nextId: number;
}

export type DemoAction =
  | { type: 'received'; request: DemoRequest }
  | { type: 'settled'; id: number }
  | { type: 'cleared' };

export const initialDemoState: DemoState = { requests: [], screens: [], freshId: null, nextId: 0 };

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'received': {
      const received: Received = {
        id: state.nextId,
        request: action.request,
        ...since(state.requests, action.request),
      };
      const screens = [
        ...state.screens.filter((screen) => screen.name !== action.request.screen),
        { name: action.request.screen, last: received },
      ].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
      // A drag sends about 25 values a second: they update the newest row instead of adding one each.
      const [newest, ...older] = state.requests;
      const requests =
        newest && sameFader(newest.request, action.request)
          ? [received, ...older]
          : [received, ...state.requests];
      return {
        requests: requests.slice(0, REQUEST_LIMIT),
        screens,
        freshId: received.id,
        nextId: state.nextId + 1,
      };
    }
    case 'settled':
      // A newer request may have arrived since; its highlight stays.
      return action.id === state.freshId ? { ...state, freshId: null } : state;
    case 'cleared':
      return { ...initialDemoState, nextId: state.nextId };
  }
}

/** The time since the newest request of the same tap's sequence, for a step after the first. */
function since(requests: Received[], request: DemoRequest): { sinceMs?: number } {
  const { sequence } = request;
  if (!sequence || sequence.step === 1) return {};
  const before = requests.find((r) => r.request.sequence?.run === sequence.run);
  if (!before) return {};
  return { sinceMs: Date.parse(request.time) - Date.parse(before.request.time) };
}

/** Two values from the same fader, one right after the other: the same drag, or its next one. */
function sameFader(a: DemoRequest, b: DemoRequest): boolean {
  return (
    a.fader !== undefined &&
    b.fader !== undefined &&
    a.screen === b.screen &&
    a.station === b.station &&
    a.hotspot === b.hotspot
  );
}
