# 0016. Load the next page on tap, then fade it in on top

Status: Accepted · Date: 2026-10-30

Supersedes [ADR 0014](0014-page-transitions.md).

## Context
A page change must never show a blank frame ([spec PG-5](../spec.md#53-pages)).
[ADR 0014](0014-page-transitions.md) avoided the wait after a tap by keeping "warm" pages: the
videos of every page reachable from the current one loaded and playing underneath it, up to a
limit to be measured on an iPad, plus every image of the project decoded at start.

Planning that measurement showed what warm pages cost:
- Every warm video keeps decoding while it is invisible: memory and decoding power on the
  tablet, and a limit that depends on the device and the size of the videos.
- A page with more video links than the limit (a menu with 20 entries) still has cold pages,
  so the wait after a tap remains for most of them.
- Decoding every image at start grows with the project: about 12 MB of memory per full-screen
  image, so a project with 100 image pages would not fit.

A short wait between a tap and the start of the fade is acceptable on a stand. A blank frame
or a flash of the background colour is not.

## Decision
- **Load on tap.** Only the page on screen and the page on its way are in the DOM. The next
  page's background starts loading when the tap is released; nothing is loaded ahead of a tap.
- **Wait for the first frame.** The incoming page stays invisible on top until its image is
  decoded or its video has its first frame, then fades in. The visitor sees the current page
  until then, never an empty frame.
- **Fade-in on top** (unchanged from ADR 0014). The incoming page fades from 0 to 1 above the
  current one, which stays fully opaque and is removed only after the fade ends.

## Alternatives considered
- **Warm pages with a measured limit** (ADR 0014). Instant for the first few links, but costs
  memory on every page, needs tuning per device, and still leaves the other links cold.
- **Poster image first, video afterwards.** Instant, but needs a poster per video (generated
  on upload) and shows a visible switch from still image to motion.
- **Start loading on touch-down instead of release.** Gains the 100–200 ms the finger rests on
  the screen, but loads a page for every touch that slides off and cancels. Worth revisiting if
  the wait proves noticeable on a stand.

## Consequences
- Memory use no longer grows with the number of links or pages: at most two backgrounds are
  loaded, during a fade.
- Every page change waits for the next background: on the iPad spike, 171 ms on average and up
  to 341 ms for a video ([spike](../spike-ipad.md)); an image on the local network is usually
  faster.
- No limit to tune on real hardware; the player no longer depends on which pages are reachable.
