# iPad check

A manual check of the player on a real iPad, for what a desktop browser cannot show: touch,
Safari's kiosk quirks, the home screen, and how long a page change waits for its background
([ADR 0016](adr/0016-load-next-page-on-tap.md)). Run it at the end of a player milestone and
record the result below.

## Setup

1. Mac and iPad on the same Wi-Fi network.
2. On the Mac, start Tapcue as on a stand: it builds the web app and serves everything on one
   port, and prints the station URLs.

```bash
npm start
```

3. Open the printed URL of station Main catalog (`http://<mac-ip>:4000/play/main`) in Safari on
   the iPad. The demo stand's Home page fills the screen.

M1 and M2 were checked with the development servers (`npm run dev`, port 5173); `npm start` is
the built app, which the "Commands and network loss" section needs anyway: in development,
Vite's own client reloads the page whenever its connection comes back.

## Checklist

Page changes (spec PG-3, PG-4, PG-5)
- [ ] The About us video plays without a tap and loops without a visible jump.
- [ ] Home ↔ About us and the product pages: no blank or black frame, no flash of the
      background colour.
- [ ] The pause between a tap and the start of the fade: not noticeable, noticeable but
      acceptable, or too long. Note it for image pages and for About us (video) separately.
- [ ] Browse for **10 minutes**: no stutter, no reload of the page.

Taps and press effects (spec ACT-2, HS-5)
- [ ] Press-in on the Product A and B cards, highlight on Back, Next and "Call our team",
      ripple on the Product C card: each visible.
- [ ] Press a card and slide the finger off before lifting: no page change.
- [ ] Two fingers on two different hotspots: no stuck pressed state.

Kiosk behaviour (spec PLY-7)
- [ ] Pinch and double tap do not zoom.
- [ ] A long press on text selects nothing; a long press on artwork shows no "Save Image"
      sheet or menu.
- [ ] Dragging up or down does not bounce the page.

Home screen (spec flow F1, step 7)
- [ ] Share → Add to Home Screen shows the Tapcue icon and the name "Tapcue".
- [ ] The icon opens `/play/main` (not the editor), without Safari's address bar or tabs.
- [ ] The status bar at the top does not cover hotspots.

Idle return (spec ST-4)
- [ ] On Product B, wait 90 seconds without touching: the player fades back to Home.

Commands and network loss (spec ACT-2, PLY-2, PLY-3)
- [ ] With `/demo` open on the Mac, "Call our team" and "Play demo" on the iPad change the
      screen-3 and screen-1 tiles within a moment.
- [ ] Turn the iPad's Wi-Fi off: "Reconnecting…" appears in the bottom-right corner after
      about 1 s, and pages still change on tap.
- [ ] Tap "Call our team", turn Wi-Fi back on within a few seconds: the indicator goes away,
      the page does **not** reload, and the tap arrives on `/demo`.
- [ ] Wi-Fi off, tap "Call our team", wait 10 s, Wi-Fi on: the indicator goes away and that
      tap does **not** arrive: taps are kept for 5 s, so a late reconnect starts nothing.

The stand (M5: spec PLY-4, NFR-3, [stand setup guide](stand-setup.md))
- [ ] Section 3 of the stand setup guide works as written on this iPad: every menu path exists
      and does what the guide says.
- [ ] In Guided Access, started from the Home Screen icon: swiping up, the Home button,
      notifications and Control Center do not leave the player.
- [ ] A triple-click and the passcode end Guided Access.
- [ ] Left untouched for **30 minutes** (Auto-Lock "Never", charging): the screen neither dims
      nor locks, and the player is still on its start page.
- [ ] **10 hours** on the charger in Guided Access, tapped now and then: the screen stays on,
      the player never reloads or shows "Loading…", and taps still reach `/demo` at the end.
      Note the battery level and anything unusual.

## Results

### M1 — player

Device: iPad Air, iPadOS 26.6.1 · Date: 2026-10-30

All items passed, including 10 minutes of browsing. The wait between a tap and the start of the
fade was acceptable for image and video pages, so loading on touch-down
([ADR 0016](adr/0016-load-next-page-on-tap.md)) is not needed.

### M2 — commands

Device: iPad Air, iPadOS 26.6.1 · Date: 2026-10-30 · Built app (`vite preview`)

All items of "Commands and network loss" passed: taps changed the tiles on `/demo`;
with Wi-Fi off, "Reconnecting…" appeared and pages still changed; after Wi-Fi came back
within a few seconds, the page did not reload and the queued tap arrived; a tap made 10 s
before Wi-Fi came back did not arrive.

### M5 — the stand

Not run yet.

## Long run

The same day without an iPad: `npm run soak` runs the built app on a server of its own (port
4700, a copy of the demo stand, demo mode so no command leaves the computer), a player in
Chromium tapping a random hotspot every few seconds, and the demo page open. Every minute it
records the server's memory and the player's, and it counts what was delivered. It passes when
every command was delivered and there were no page errors, reloads or lost connections. The
report is written to `e2e/soak-results/` (not in git).

```bash
npm run build
```

```bash
npm run soak -- --minutes 600
```

`--interval` sets the seconds between taps (5 by default), `--station` the station (`main`). It
runs on macOS and Linux.

### Results

| Date | Length | Taps | Delivered | Server memory, settled → end | Player heap | Result |
|---|---|---|---|---|---|---|
| 2026-11-03 | 3 min (trial, a tap every 2 s) | 89 | 56 of 56 | 152 → 131 MB | 10 → 10 MB | Passed |
| 2026-11-05 → 06 | 10 h (a tap every 5 s) | 7155 | 4489 of 4489 | 102 → 85 MB (82–121 MB over the run) | 10 → 10 MB | Passed: no page errors, reloads or reconnects |
