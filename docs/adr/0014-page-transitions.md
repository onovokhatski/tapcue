# 0014. Warm next-page videos and fade-in on top

Status: Superseded by [0016](0016-load-next-page-on-tap.md) · Date: 2026-10-27

## Context
Pages can have video backgrounds, and a page change must never show a blank frame
([spec PG-5](../spec.md#53-pages)). The [iPad spike](../spike-ipad.md) showed that swapping a
video's source shows a blank frame, that loading the next video on tap delays the transition by
up to ~340 ms, and that fading two layers at once lets the background show through mid-fade.

## Decision
- **Warm pages.** While a page is shown, the player keeps the backgrounds of the pages it can
  lead to (hotspot `goTo` targets and the station's start page) loaded underneath it, videos
  muted and playing. A tap can then fade immediately.
- **Fade-in on top.** The incoming page is placed above the current one and fades from 0 to 1;
  the current page stays fully opaque and is hidden only after the fade ends.
- **Fallback.** If the incoming background is not ready yet (e.g. too many neighbours to keep
  warm), the player waits for its first frame, then fades — never swaps into an empty frame.
- **Limit.** At most a small, fixed number of videos stay warm at once; the exact number is
  measured on a real iPad in M1.

## Alternatives considered
- **Load on tap, then fade.** Clean, but up to ~340 ms of dead time after every tap.
- **Poster image first, video afterwards.** Instant, but needs a poster per video (generated
  on upload) and shows a visible switch from still image to motion.
- **Keep every page's video warm.** Simplest, but memory and battery grow with the project.

## Consequences
- Page changes start immediately in the common case.
- The player's preloading logic depends on the project graph (which pages are reachable).
- Warm videos cost memory and decoding power; the limit must be tuned on real hardware.
