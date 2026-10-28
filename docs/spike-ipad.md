# Spike: iPad playback, screen wake and latency

Date: 2026-10-27 · Status: **done** · Plan: [roadmap §3](roadmap.md#3-spike--technical-risks)

A throw-away test page and server checked the riskiest technical assumptions on a real iPad
before the design phase. The spike code was not kept; this document and the ADRs it led to are
the result.

## Setup

- **Tablet:** iPad, iPadOS 26.6, Safari and Chrome (Chrome on iPad uses the same WebKit engine).
- **Server:** Node.js on a Mac, same Wi-Fi network; page served over plain `http://` from the
  Mac's local IP address — exactly how Tapcue will be served on a stand.
- **Media:** 1920×1080 H.264 loops, 30 fps, 6 Mbit/s, no audio, `faststart`
  (as recommended in [spec Appendix A](spec.md#appendix-a-recommended-media)).

## Results

| Question | Result | Verdict |
|---|---|---|
| Does a muted looped video autoplay without a tap? | Started in 236 ms after load, no gesture | **Pass** |
| Is the loop seamless? | Frame gap at the loop point 33 ms = one frame at 30 fps | **Pass** |
| Is the Screen Wake Lock API available? | No: `navigator.wakeLock` is undefined on `http://` (secure context required) | **Fail** |
| Does anything on the page keep the screen awake? | Inconclusive: the screen stayed on in every mode, including the control with nothing running, so the device's own settings decided, not the page | **Not controllable from the page** |
| Tap → UDP packet leaves the server, 95th percentile | Chrome 41 ms, Safari 66 ms (real taps over Wi-Fi); worst single sample 168 ms | **Pass** (budget 100 ms) |
| Page change between video backgrounds without a blank frame | Swapping the source: visible blank frame. Waiting for the first frame, then fading: clean | **Pass, with the right technique** |

## Findings

1. **Swapping a video's source shows a blank frame.** The element is empty until the new
   video's first frame is decoded. The next page must be ready before the transition starts.
2. **Waiting for the first frame costs time.** Loading the next video only on tap delayed the
   start of the fade by 171 ms on average and up to 341 ms. Keeping the next page's video
   loaded and playing underneath ("warm") removes the wait: the fade starts immediately.
3. **Cross-fading two layers at once lets the background show through.** If the old page fades
   out while the new one fades in, both are half-transparent mid-fade and the stage background
   is visible — a dark "blink" on every page change. The new page must fade in **on top of**
   the old one, which stays fully opaque until the fade ends.
4. **The page cannot reliably keep an iPad awake over `http://`.** Wake Lock needs a secure
   context, and the device's settings (Auto-Lock, attention awareness) decide the rest.
5. **Latency is well within budget**, but Wi-Fi adds variance (one 168 ms outlier). A dedicated
   access point for the stand is worth recommending.
6. **iPad Safari identifies itself as desktop Safari** (Macintosh user agent). The player must
   rely on feature detection, never on user-agent sniffing.

## Decisions

- [0014. Warm next-page videos and fade-in on top](adr/0014-page-transitions.md)
- [0015. Screen wake is part of stand setup, not a player guarantee](adr/0015-screen-wake.md)

## Not covered

- **Memory with many warm videos.** Only two videos were tested. The limit on how many videos
  can stay warm at once is checked on a real iPad in M1.
- **Home-screen mode and Guided Access** were not tested separately; they use the same engine
  and are verified on real devices in M5.
