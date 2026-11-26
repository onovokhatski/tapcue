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

function volume(value: number, hotspot = 'Volume'): DemoRequest {
  return {
    ...request('screen-1', 'volume'),
    method: 'PUT',
    body: String(value),
    hotspot,
    fader: { value, min: 0, max: 100 },
  };
}

describe('demo receiver state', () => {
  it("updates one row with a fader's values in a row, instead of adding one each (ADR 0020)", () => {
    const state = receive(volume(10), volume(20), volume(30));
    expect(state.requests.map((r) => [r.id, r.request.body])).toEqual([[2, '30']]);
    expect(state.screens.map((s) => s.last.request.fader?.value)).toEqual([30]);
    expect(state.freshId).toBe(2);
  });

  it('starts a new row after another request, or for another fader on the screen', () => {
    const state = receive(
      volume(10),
      request('screen-1', 'product-a'),
      volume(20),
      volume(30, 'Brightness'),
    );
    expect(state.requests.map((r) => [r.request.content, r.request.hotspot])).toEqual([
      ['volume', 'Brightness'],
      ['volume', 'Volume'],
      ['product-a', 'Play demo'],
      ['volume', 'Volume'],
    ]);
  });

  it('starts a new row for a fader with the same name on another screen', () => {
    const state = receive(volume(10), { ...volume(20), screen: 'screen-2' });
    expect(state.requests.map((r) => r.request.screen)).toEqual(['screen-2', 'screen-1']);
  });

  it('adds a row for each tap, also on a request the same as the last', () => {
    const state = receive(request('screen-1', 'product-a'), request('screen-1', 'product-a'));
    expect(state.requests).toHaveLength(2);
  });

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

describe('steps of a sequence (ADR 0022)', () => {
  const step = (run: number, n: number, time: string): DemoRequest => ({
    ...request('screen-1', `step-${n}`),
    time,
    sequence: { run, step: n, of: 3 },
  });

  it('says how long after the step before of the same tap a later step came', () => {
    const state = receive(
      step(4, 1, '2026-10-30T14:05:09.000Z'),
      step(9, 1, '2026-10-30T14:05:09.500Z'), // another tap in between
      step(4, 2, '2026-10-30T14:05:10.500Z'),
      step(4, 3, '2026-10-30T14:05:11.000Z'),
    );
    expect(state.requests.map((r) => r.sinceMs)).toEqual([500, 1500, undefined, undefined]);
  });

  it('leaves out the time for a first step, even one whose run number came before', () => {
    // Run numbers start over when the server restarts, so an old run 4 may still be on the page.
    const state = receive(
      step(4, 2, '2026-10-30T14:05:09.000Z'),
      step(4, 1, '2026-10-30T14:06:00.000Z'),
    );
    expect(state.requests[0]).not.toHaveProperty('sinceMs');
  });

  it('leaves out the time for a first step, and when the step before is not on the page', () => {
    const state = receive(step(4, 2, '2026-10-30T14:05:10.500Z'));
    expect(state.requests[0]).not.toHaveProperty('sinceMs');
  });
});
