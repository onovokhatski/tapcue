# Tapcue — Claude Design prompts

Prompts for designing Tapcue from scratch in Claude Design. Use them **in order, in one
project**: prompt 0 sets the context once, every later prompt builds on what exists.
After each prompt, review the result and correct it before moving on.

Sources of truth: [spec.md](../spec.md), [project-format.md](../project-format.md),
[architecture.md](../architecture.md). The Figma file (screen map, wireframes, tokens,
components) is a reference, not a constraint.

---

## Prompt 0 — Project brief

```
You are designing Tapcue, a web tool for exhibition-stand integrators.

WHAT IT DOES
An exhibition stand has a large screen, a few smaller screens and a tablet for visitors.
A media server (QLab, Resolume, etc.) plays the content on the screens. Tapcue lets an
integrator turn designer-made artwork into the tablet interface in an evening:
- each page of the interface is a background image or a looping video drawn by a designer;
- "hotspots" are placed over the drawn buttons: usually invisible, optionally styled
  (fill, border, opacity, rectangle with corner radius or ellipse) with a press effect
  (highlight, press-in, ripple);
- tapping a hotspot goes to another page, sends a command to the media server
  (OSC over UDP, raw UDP or HTTP), or both;
- "stations" are entry points: each tablet opens a station URL (shown as a QR code) with
  its own start page and an idle timeout that returns to the start page.
All show logic stays on the media server. Tapcue only provides the interface and delivers
commands. Everything runs in the stand's local network, no internet, no accounts.

THREE APPS, ONE PRODUCT
1. Editor (/edit) — for the integrator, desktop browser, 1440×900 and up. The main work.
2. Player (/play/:station) — for visitors, full-screen on an iPad (1024×768 landscape is the
   reference). Shows ONLY the designer's artwork; Tapcue adds no visible UI except a tiny
   connection indicator when the network drops.
3. Demo receiver (/demo) — for reviewers trying the project without hardware: shows the
   commands a tap sends, as they arrive.

USERS
- Integrator: technical, works on a busy stand during setup, often standing, tablet in the
  other hand. Needs speed, clarity, and to trust what the editor shows.
- Visitor: never sees Tapcue itself, only the artwork.
- Reviewer: a hiring manager or developer exploring the project for a few minutes.

DESIGN PRINCIPLES
- The artwork is the hero. Editor chrome is calm and neutral so images and videos read
  honestly; colour is reserved for selection, primary actions and status.
- What you see in the editor is exactly what the visitor sees: the editor canvas renders the
  real page; editor-only overlays (hotspot outlines, handles) sit on top.
- Show every state: empty, loading, saving, saved, error, disconnected, disabled.
- Dense but not cramped: this is a professional tool, not a marketing site.
- No emoji anywhere. Status uses text plus a shape or colour, never colour alone.
- Accessibility: WCAG 2.2 AA contrast, visible focus, keyboard-reachable controls.

VISUAL DIRECTION (decided)
- Light theme.
- Accent: warm amber "cue light", like a standby lamp on a stage console. Amber fills carry
  dark text; amber is never used as text colour on white (use a dark amber for links).
- Neutrals: warm grey (stone).
- Type: Inter for UI, JetBrains Mono for OSC addresses, IPs, URLs and timestamps.
- Spacing on a 4 px grid (Tailwind scale). Radii 4 / 6 / 10 / 16 / full.

IMPLEMENTATION CONTEXT
The design will be built in React + Tailwind CSS. Name tokens so they map 1:1 to CSS
variables (e.g. color/text/secondary → --color-text-secondary). Build reusable components
with variants and states rather than one-off elements.

Use realistic demo content: a fictional stand "Demo stand" with pages Home, Product A,
Product B, About us; targets "Resolume" (OSC/UDP 192.168.1.20:7000), "Projector"
(UDP 192.168.1.40:4352), "Demo receiver" (HTTP http://localhost:4000); stations
"Main catalog" (main) and "Small screen" (small).

Do not design anything yet. Confirm you understand, list the questions you would ask
before starting, and propose the order in which you would design the screens.
```

---

## Prompt 1 — Design system

```
Create the Tapcue design system.

TOKENS
- Colour: primitives (stone, amber, plus red/green/orange/blue for status) and semantic
  tokens on top of them: bg/app, bg/surface, bg/subtle, bg/canvas, bg/inverse;
  border/default, border/strong, border/focus; text/primary, text/secondary, text/muted,
  text/inverse, text/on-accent, text/link; accent/default, accent/hover, accent/pressed,
  accent/subtle, accent/strong; selection; status success/warning/danger/info (fg, bg).
  Warning must be clearly distinguishable from the amber accent.
- Type styles: Heading XL/L/M, Body M/S, Label M/S, Overline, Mono M/S.
- Spacing scale (4 px steps), radii, three elevation levels, focus ring.
Show a specimen page with every token and its value, and check contrast for every
text/background pair you use.

COMPONENTS (each with all variants and states, built on the tokens)
- Icon set (16 px line icons): plus, trash, copy, external link, chevron down, drag grip,
  close, check, alert, wifi off.
- Button: Primary, Secondary, Ghost, Danger × Default, Hover, Pressed, Disabled, Focus;
  optional leading icon.
- Text field: Default, Focus, Error, Disabled; label, value, helper or error text; mono option.
- Select: Default, Open, Disabled.
- Number field (compact, for X / Y / W / H).
- Color field: colour swatch + hex, or "None".
- Segmented control: 2–3 options.
- Tab (top navigation): Active, Inactive.
- List item: Default, Hover, Selected; thumbnail, title, meta, drag handle.
- Status badge: Connected, Disconnected, Saving, Saved, Error, Sent.
- Log row: Sent, Error, Navigation only.
- Hotspot overlay (editor canvas only): Idle (dashed, so invisible hotspots can be found),
  Hover, Selected (outline, name chip, 8 resize handles) × Rectangle, Ellipse. Must stay
  visible on top of any artwork, light or dark.
- Connection indicator (player): small pill "Reconnecting…".
- Dialog: Default and Danger confirmation.
- Banner: Info, Warning.
- QR card: QR code, URL in mono, Copy and Open buttons.
Lay out each component with its variants labelled, and add one line on when to use it.
```

---

## Prompt 2 — Editor: Pages (main screen)

```
Design the main editor screen, "Pages", at 1440×900, using only the design system.

LAYOUT
- Top bar: product name, project name, tabs (Pages, Targets, Stations, Settings),
  connection status and save status on the right.
- Left: page list (add, rename, reorder by drag, delete), thumbnails of each page.
- Centre: the canvas. The current page (2048×1536, shown scaled to fit) with its background
  and hotspots. A toolbar above it: "Add hotspot" (primary), "Show safe area", zoom level.
- Right: properties panel (scrolls). With a hotspot selected: Name; Position X, Y, W, H;
  Shape (rectangle / ellipse) and corner radius; Style: fill, border, opacity; Press effect;
  On tap: Go to page, Send command to (target), and the command fields for that target's
  protocol (OSC: address + typed arguments int/float/string; UDP: text; HTTP: method, path,
  body). With nothing selected: page properties (name, background image or video, upload).
- Bottom: command log panel (collapsible) with the latest commands.

FRAMES TO PRODUCE
1. Hotspot selected (the default view).
2. Nothing selected (page properties, background upload).
3. Uploading a video background (progress), and an upload error.
4. "Show safe area" on, with the canvas in Fill mode: the parts of the page that may be
   cropped on screen are clearly marked.
5. Command log collapsed to a single line showing the last command.
Use a real-looking product photo or gradient artwork as the page background so the
hotspot overlay is tested on top of real content.
```

---

## Prompt 3 — Editor: Targets

```
Design the "Targets" tab at 1440×900 using the same shell (top bar, command log).

- Left: list of targets with protocol as meta ("OSC over UDP", "UDP", "HTTP").
- Main: form for the selected target. Name; Protocol (segmented control); fields that change
  with the protocol: OSC over UDP and UDP → Host + Port; HTTP → Base URL.
  Under the form: "Used by 3 hotspots: Product A, Product B, Product C".
- Delete opens a Danger dialog: deleting clears the command on those hotspots.

FRAMES: populated; empty state (no targets yet, with a clear first action); invalid host
and port (inline errors); delete confirmation dialog.
```

---

## Prompt 4 — Editor: Stations

```
Design the "Stations" tab at 1440×900 using the same shell.

- Left: list of stations.
- Main: form — Name; Id (used in the URL, slug); Start page (select);
  Return to start after idle (5–3600 s, or Off).
- Next to the form: the QR card for this station's URL
  (http://192.168.1.10:4000/play/main) with Copy and Open. The integrator scans it with the
  tablet camera to set the tablet up.
- Editing the id shows a Warning banner: the URL on tablets already set up will stop working.

FRAMES: populated; empty state; id being edited with the warning; URL copied confirmation.
```

---

## Prompt 5 — Editor: Settings and project transfer

```
Design the "Settings" tab at 1440×900 using the same shell.

- Canvas: width and height in pixels, background colour, scale mode
  (Fit — whole page visible, bars where aspect ratios differ / Fill — screen covered, edges
  may be cropped). Show a small diagram that explains Fit vs Fill.
- Project: Export .zip, Import .zip.

FRAMES: default; import confirmation dialog ("Replace the current project?");
import error (invalid file, with the reason); demo mode, where saving, upload and import are
disabled and an Info banner explains that changes stay in this browser tab.
```

---

## Prompt 6 — Player

```
Design the visitor-facing player at 1024×768 (iPad, landscape).

The player shows ONLY the designer's artwork, full-screen, no Tapcue branding or controls.
Create an example interactive catalogue page drawn as artwork (a home page with three
product cards and an "About" button), then show:
1. The page as the visitor sees it.
2. The same page with the hotspot areas annotated for the handoff (annotation layer only,
   not visible to visitors).
3. A press effect in progress on one card: highlight, press-in and ripple (three small frames).
4. The fade transition between Home and Product A (three frames: start, middle, end) —
   the new page fades in ON TOP of the old one, which stays fully opaque.
5. Network lost: the small "Reconnecting…" indicator in a corner, unobtrusive.
6. "Station not found": a plain Tapcue page with the unknown station id and links to the
   existing stations, for the integrator during setup.
```

---

## Prompt 7 — Demo receiver

```
Design the demo receiver at 1280×800, the page a reviewer opens next to the player.

- Header: "Demo receiver", listening address.
- Tiles for "Screen 1", "Screen 2", "Screen 3", each showing what that screen is "playing"
  now (e.g. product-a), updated live with a subtle highlight when it changes.
- Below: live log of received requests (time, station, hotspot, method, path, status).

FRAMES: waiting for the first command (empty state with a hint: open /play/main in another
tab and tap something); receiving; a new command just arrived (highlight).
This page is part of the portfolio demo: it should look polished and make the
tap → command flow obvious within seconds.
```

---

## Prompt 8 — Consistency review and handoff

```
Review the whole design:
1. Every screen uses only design-system components and tokens; list any one-off element
   and either turn it into a component or replace it.
2. Every state from the screen list is designed: empty, loading, saving, saved, error,
   disconnected, disabled, demo mode.
3. Contrast meets WCAG 2.2 AA everywhere; focus is visible on every interactive element.
4. Hotspot overlays stay readable on both light and dark artwork.
Then produce a handoff summary:
- the token list with values, in CSS-variable form (--color-text-secondary: …);
- the component inventory with variants, states and props;
- per screen, the components it uses.
```
