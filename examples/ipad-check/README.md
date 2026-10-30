# iPad check (issue #30)

A temporary test project and checklist for running the M1 player on a real iPad. It answers the
question [ADR 0014](../../docs/adr/0014-page-transitions.md) left open: **how many videos can stay
warm at once** (`WARM_VIDEO_LIMIT` in `packages/web/src/player/warmPages.ts`, 2 for now). It also
covers what could not be checked in a desktop browser. Delete this folder once #30 is done.

## The test project

`make.mjs` generates `project.json` and `assets/` (both git-ignored), and copies `stats.js`, the
on-screen stats panel, into `assets/`:

| Page | Background | Buttons |
|---|---|---|
| Hub (start page) | `hub.jpg` | V1–V6 |
| Video 1 … Video 6 | `video-N.mp4`, a 6-second H.264 loop, 1920 × 1440, 30 fps, 3 Mbit/s (the demo stand's settings) | Hub and every other video |

Every page links to every other page, so each page has up to five video neighbours. On a
video page the screen decodes **the limit plus one** videos: the shown one and the warm ones.
On the hub it decodes exactly the limit. A button for a warm page fades at once; a button for a
cold page waits for the video's first frame first.

```bash
node examples/ipad-check/make.mjs
```

macOS only (uses the demo stand's Swift tools); takes about 20 seconds.

## Setup

1. Mac and iPad on the same Wi-Fi network.
2. Start the server with the test project and the web app open to the network, in two terminals:

```bash
TAPCUE_PROJECT=$PWD/examples/ipad-check npm run dev -w @tapcue/server
```

```bash
npm run dev -w @tapcue/web -- --host
```

3. Find the Mac's address (`ipconfig getifaddr en0`) and open `http://<mac-ip>:5173/play/ipad?stats`
   on the iPad.

`?stats` shows a small panel over the page (it does not take taps), updated every second:

| Line | Meaning |
|---|---|
| `up 1:23` | Time since the page loaded. If it drops back to `0:00` without you changing the code, iPadOS reloaded the page: it ran out of memory. |
| `long frames (>50 ms)` | Visible hitches of the page since load. A few at start and on taps are normal; a number that keeps growing while you only watch is not. |
| One row per video | Its page, layer (`shown`, `incoming`, `warm`), whether it plays, `readyState` (4 is fully buffered) and dropped / total frames. |
| `worst dropped` | The worst dropped share each video has had since load. |

Web Inspector is not needed. If it is at hand (it needs one cable connection first), Timelines →
Memory adds the memory peak; nothing else depends on it.

## Part A — the warm-video limit

Write down the iPad model and iPadOS version (Settings → General → About).

For each limit: set `WARM_VIDEO_LIMIT` in `warmPages.ts` and save (the iPad reloads with the panel).
Browse for about 2 minutes. Go to every video, both from the hub and from video to video, and also
tap quickly between videos. Then fill in the row from the panel and what you saw.

| Limit | Worst dropped (panel) | Long frames after 2 min | Stutter or frozen video? | Fade starts at once for warm pages? | Page reloaded (`up` reset) or "A problem repeatedly occurred"? |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

Stop raising the limit at the first stutter or reload. **The limit to keep is the last row with
none of them**, minus one if it was borderline, because real stands use larger videos than these
test loops.

## Part B — the demo stand

Restart the server without `TAPCUE_PROJECT` (it then serves the demo stand), keep the web app
running with `--host`, set `WARM_VIDEO_LIMIT` to the result of Part A, and open
`http://<mac-ip>:5173/play/main` (the stats panel is not available here: it is served from the
test project's assets).

Playback and page changes
- [ ] The About us video plays without a tap and loops without a visible jump.
- [ ] Home ↔ About us and the other pages: no blank or black frame, no flash of the background colour.
- [ ] Browse for **10 minutes**: no stutter, no reload.

Taps and press effects
- [ ] Press-in on the Product A and B cards, highlight on Back, Next and "Call our team", ripple on
      the Product C card: each visible (ripple and highlight are expected to be faint on white artwork).
- [ ] Press a card and slide the finger off before lifting: no page change.
- [ ] Two fingers on two different hotspots: no stuck pressed state.

Kiosk behaviour (spec PLY-7)
- [ ] Pinch and double tap do not zoom.
- [ ] A long press on text selects nothing; a long press on artwork shows no "Save Image" sheet or menu.
- [ ] Dragging up or down does not bounce the page.

Home screen
- [ ] Share → Add to Home Screen shows the Tapcue icon and the name "Tapcue".
- [ ] The icon opens `/play/main` (not the editor), without Safari's address bar or tabs.
- [ ] The status bar at the top does not cover hotspots (decide whether artwork should go under it).

Idle return
- [ ] On Product B, wait 90 seconds without touching: the player fades back to Home.

## Results

Report the table, the device, and any unchecked box. The results then go into ADR 0014 (the
limit and the device) and `docs/spike-ipad.md` (the M1 measurement), the limit goes into
`warmPages.ts`, and this folder is deleted. All of this lands in the PR that closes #30.
