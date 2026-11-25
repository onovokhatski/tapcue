// How long a page change waits after a tap, so the visitor sees the press effect let go (spec ACT-2).
import type { PressEffect } from '@tapcue/shared';

/**
 * Milliseconds, matching the release timings in tokens.css; keep both in sync.
 * highlight: --duration-press-out; press-in: --duration-fast. A ripple keeps playing over the
 * transition and never delays it.
 */
const RELEASE_MS: Record<PressEffect, number> = {
  none: 0,
  highlight: 160,
  press: 120,
  ripple: 0,
  // Pop and glow are drawn by the player from v0.10's player work (issue #273); until then they
  // show nothing, so nothing waits for them.
  pop: 0,
  glow: 0,
};

export function releaseDelay(effect: PressEffect): number {
  return RELEASE_MS[effect];
}
