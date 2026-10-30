import { describe, expect, it } from 'vitest';
import { createTapQueue, TAP_MAX_AGE_MS } from './tapQueue';

const tap = (hotspotId: string) => ({ type: 'tap', pageId: 'p_home00', hotspotId }) as const;

describe('tap queue (spec PLY-3)', () => {
  it('keeps taps for 5 s', () => {
    expect(TAP_MAX_AGE_MS).toBe(5000);
  });

  it('returns the taps up to 5 s old, oldest first, and drops older ones', () => {
    let now = 0;
    const queue = createTapQueue(() => now);
    queue.add(tap('h_old000'));
    now = 1000;
    queue.add(tap('h_mid000'));
    now = 2000;
    queue.add(tap('h_new000'));
    now = 6000; // h_old000 is 6 s old, h_mid000 exactly 5 s
    expect(queue.takeFresh()).toEqual([tap('h_mid000'), tap('h_new000')]);
  });

  it('empties itself, so a tap is never sent twice', () => {
    const queue = createTapQueue(() => 0);
    queue.add(tap('h_carda0'));
    queue.takeFresh();
    expect(queue.takeFresh()).toEqual([]);
  });
});
