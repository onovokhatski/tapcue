# iPad check

A manual check of the player on a real iPad, for what a desktop browser cannot show: touch,
Safari's kiosk quirks, the home screen, and how long a page change waits for its background
([ADR 0016](adr/0016-load-next-page-on-tap.md)). Run it at the end of a player milestone and
record the result below.

## Setup

1. Mac and iPad on the same Wi-Fi network.
2. On the Mac, in two terminals:

```bash
npm run dev -w @tapcue/server
```

```bash
npm run dev -w @tapcue/web -- --host
```

3. Find the Mac's address (`ipconfig getifaddr en0`) and open `http://<mac-ip>:5173/play/main`
   in Safari on the iPad. The demo stand's Home page fills the screen.

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

Commands and network loss (spec ACT-2, PLY-2, PLY-3) — needs the built app, see below
- [ ] With `/demo` open on the Mac, "Call our team" and "Play demo" on the iPad change the
      screen-3 and screen-1 tiles within a moment.
- [ ] Turn the iPad's Wi-Fi off: "Reconnecting…" appears in the bottom-right corner after
      about 1 s, and pages still change on tap.
- [ ] Tap "Call our team", turn Wi-Fi back on within a few seconds: the indicator goes away,
      the page does **not** reload, and the tap arrives on `/demo`.
- [ ] Wi-Fi off, tap "Call our team", wait 10 s, Wi-Fi on: the indicator goes away and that
      tap does **not** arrive: taps are kept for 5 s, so a late reconnect starts nothing.

For this section, serve the built app instead of the dev server. In development, Vite's own
client reloads the page whenever its connection comes back, which would hide what the player
does. Stop `npm run dev -w @tapcue/web`, then:

```bash
npm run build -w @tapcue/web
```

```bash
npm run preview -w @tapcue/web -- --host --port 5173
```

The preview proxies `/api`, `/assets`, `/ws` and `/demo/` to the server just like the dev
server, so the same address works on the iPad.

## Results

### M1 — player

Device: iPad (model and iPadOS version not recorded) · Date: 2026-10-30

All items passed, including 10 minutes of browsing. The wait between a tap and the start of the
fade was acceptable for image and video pages, so loading on touch-down
([ADR 0016](adr/0016-load-next-page-on-tap.md)) is not needed.
