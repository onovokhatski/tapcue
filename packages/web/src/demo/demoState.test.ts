import type { DemoRequest } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { type DemoState, demoReducer, initialDemoState, REQUEST_LIMIT } from './demoState';

function request(screen: string, content: string): DemoRequest {
  return {
    time: '2026-10-30T14:05:09.123Z',
    method: 'POST',
    path: `/demo/${screen}/${content}`,
    screen,
    content,
    body: null,
    station: 'main',
    hotspot: 'Play demo',
  };
}

function receive(...requests: DemoRequest[]): DemoState {
  return requests.reduce(
    (state, r) => demoReducer(state, { type: 'received', request: r }),
    initialDemoState,
  );
}

describe('demo receiver state', () => {
  it('lists requests newest first', () => {
    const state = receive(request('screen-1', 'product-a'), request('screen-1', 'product-b'));
    expect(state.requests.map((r) => [r.id, r.request.content])).toEqual([
      [1, 'product-b'],
      [0, 'product-a'],
    ]);
  });

  it('keeps one tile per screen with the content it last received', () => {
    const state = receive(
      request('screen-1', 'product-a'),
      request('screen-3', 'call-staff'),
      request('screen-1', 'product-b'),
    );
    expect(state.screens.map((s) => [s.name, s.last.request.content])).toEqual([
      ['screen-1', 'product-b'],
      ['screen-3', 'call-staff'],
    ]);
  });

  it('orders tiles by name with numbers in order: screen-2 before screen-10', () => {
    const state = receive(
      request('screen-10', 'x'),
      request('screen-2', 'x'),
      request('lobby', 'x'),
    );
    expect(state.screens.map((s) => s.name)).toEqual(['lobby', 'screen-2', 'screen-10']);
  });

  it('marks the newest request as fresh until it settles', () => {
    let state = receive(request('screen-1', 'product-a'));
    expect(state.freshId).toBe(0);
    state = demoReducer(state, { type: 'settled', id: 0 });
    expect(state.freshId).toBeNull();
  });

  it('keeps a newer request fresh when an older one settles', () => {
    let state = receive(request('screen-1', 'product-a'), request('screen-1', 'product-b'));
    state = demoReducer(state, { type: 'settled', id: 0 });
    expect(state.freshId).toBe(1);
  });

  it(`keeps the last ${REQUEST_LIMIT} requests`, () => {
    const state = receive(
      ...Array.from({ length: REQUEST_LIMIT + 1 }, (_, i) => request('screen-1', `c${i}`)),
    );
    expect(state.requests).toHaveLength(REQUEST_LIMIT);
    expect(state.requests.at(-1)?.request.content).toBe('c1');
  });

  it('clears everything but keeps numbering, so React keys never repeat', () => {
    let state = receive(request('screen-1', 'product-a'));
    state = demoReducer(state, { type: 'cleared' });
    expect(state).toEqual({ ...initialDemoState, nextId: 1 });
    state = demoReducer(state, { type: 'received', request: request('screen-1', 'product-b') });
    expect(state.requests[0]?.id).toBe(1);
  });
});
