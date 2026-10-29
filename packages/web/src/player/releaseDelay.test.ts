import { describe, expect, it } from 'vitest';
import { releaseDelay } from './releaseDelay';

describe('releaseDelay (spec ACT-2)', () => {
  it('waits for the release of highlight (160 ms) and press-in (120 ms)', () => {
    expect(releaseDelay('highlight')).toBe(160);
    expect(releaseDelay('press')).toBe(120);
  });

  it('never delays a page change for a ripple or no effect', () => {
    expect(releaseDelay('ripple')).toBe(0);
    expect(releaseDelay('none')).toBe(0);
  });
});
