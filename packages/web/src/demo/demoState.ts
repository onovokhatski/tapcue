// What the demo receiver page shows: requests newest first, and one tile per screen with the
// content it last received (spec DEMO-1). Pure transitions for useReducer.
import type { DemoRequest } from '@tapcue/shared';

/** Enough to scroll back through a demo; older rows are dropped so a long session stays light. */
export const REQUEST_LIMIT = 200;

export interface Received {
  /** Numbers requests in the order they arrived, for React keys and the "new" highlight. */
  id: number;
  request: DemoRequest;
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
      const received = { id: state.nextId, request: action.request };
      const screens = [
        ...state.screens.filter((screen) => screen.name !== action.request.screen),
        { name: action.request.screen, last: received },
      ].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
      return {
        requests: [received, ...state.requests].slice(0, REQUEST_LIMIT),
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
