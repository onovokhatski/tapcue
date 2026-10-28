# Tapcue — MVP Specification

Status: **draft** · Last updated: 2026-10-25

## 1. Overview

**Problem.** Exhibition stands often combine a large screen, a few smaller screens and a
tablet for visitors. Tapping something on the tablet should bring up related content on the
screens. Content is played by a media server (QLab, Resolume, etc.). Today integrators either
write one-off code for every stand or use control tools whose interfaces are built for
technicians, not for the public.

**Solution.** Tapcue lets an integrator turn designer-made artwork into a touch interface in
an evening. Each page is a background image or video; invisible or styled hotspots are placed
on top of it. A tap navigates between pages and/or sends a command to the media server.
All show logic stays on the media server — Tapcue only provides the interface and delivers
commands.

**One-liner.** *Beautiful touch interfaces for exhibition stands, wired to your media server.*

## 2. Users

| Role | Who | What they need |
|---|---|---|
| **Integrator** | Technical person who sets up the stand | Build and adjust the interface quickly, connect it to the media server, trust that it works all day |
| **Visitor** | Member of the public at the stand | Tap something beautiful and see the related content on the screens; no learning curve |
| **Reviewer** | Someone evaluating the project (e.g. a hiring manager) | Run a demo without any hardware or third-party software |

## 3. Goals and non-goals

**Goals**
- An integrator builds a multi-page interface from images/videos without writing code.
- The interface looks exactly as the designer drew it: Tapcue adds interactivity, not visuals of its own.
- A tap reaches the media server reliably over the local network.
- One server serves several tablets, each possibly with its own interface.
- The whole system can be demonstrated in a browser without external hardware.

**Non-goals (MVP)**
- Show logic (conditions, timers, sequences) — this belongs to the media server.
- Knowing what the media server is actually playing (no state feedback).
- A graphic editor: artwork is made in the designer's own tools.
- Operation over the internet, multiple users, roles.

## 4. Concepts

| Term | Meaning |
|---|---|
| **Project** | Everything describing one stand: a folder with `project.json` and `assets/`. One server runs one project. |
| **Canvas** | The fixed design size of all pages (e.g. 2048×1536) and the scale mode used on screens. |
| **Scale mode** | `fit` — whole canvas visible, empty bars where aspect ratios differ. `fill` — screen fully covered, canvas edges may be cropped. |
| **Page** | One screen of the interface: a background plus hotspots. |
| **Background** | An image, or a video played muted and looped. |
| **Hotspot** | A tappable area on a page with a shape, a style, a press effect and an action. |
| **Action** | What a tap does: go to a page, send a command, or both. |
| **Target** | A named destination for commands (e.g. "Resolume main"): protocol + address. |
| **Command** | The payload sent to a target (e.g. an OSC address with arguments). |
| **Driver** | Server component that delivers commands for one protocol. |
| **Station** | A named entry point into the project with its own start page and idle timeout. A tablet opens one station. |
| **Player** | The visitor-facing app that runs a station on a tablet or any browser. |
| **Editor** | The integrator-facing app for building the project. |
| **Demo receiver** | A built-in page that receives HTTP commands and displays them, used for demos and tests. |

## 5. Functional requirements

IDs are referenced from issues and tests.

### 5.1 Project

- **PRJ-1** The server loads one project from a folder on disk at startup.
- **PRJ-2** The project is validated against the schema on load and on every save; invalid data is rejected with a readable error.
- **PRJ-3** The integrator can export the project as a single `.zip` file.
- **PRJ-4** The integrator can import a project from a `.zip` file, replacing the current one after confirmation.

### 5.2 Canvas

- **CNV-1** The canvas has a custom width and height in pixels.
- **CNV-2** The canvas has a scale mode: `fit` or `fill`.
- **CNV-3** Hotspot coordinates are stored in canvas pixels and scale together with the background.

### 5.3 Pages

- **PG-1** The integrator can create, rename, reorder and delete pages.
- **PG-2** A page background is an image (JPEG, PNG, WebP) or a video (MP4/H.264), uploaded by the integrator.
- **PG-3** A video background plays muted, looped and starts automatically.
- **PG-4** Page changes use a fade transition.
- **PG-5** A page change never shows a blank frame: the next background is ready before the fade starts.
- **PG-6** Uploaded files are limited to 200 MB each (see [Appendix A](#appendix-a-recommended-media)).

### 5.4 Hotspots

- **HS-1** The integrator adds a hotspot with an "Add hotspot" button; it appears in the centre of the page with a default size.
- **HS-2** A hotspot can be selected, moved and resized on the canvas, and positioned precisely with numeric fields (x, y, width, height).
- **HS-3** Shape: rectangle (with optional corner radius) or ellipse.
- **HS-4** Style: invisible, or fill colour, border colour and width, opacity.
- **HS-5** Press effect: none, highlight, press-in, or ripple.
- **HS-6** Hotspots can be deleted and their stacking order changed.
- **HS-7** A hotspot can be duplicated: the copy gets a new id, the same properties and a small
  offset, clamped to the canvas, and becomes the selection.

### 5.5 Actions

- **ACT-1** A hotspot action can navigate to a page, send a command to a target, or both.
- **ACT-2** When an action does both, the command is sent first, then the page changes.
- **ACT-3** Navigation happens immediately on the tablet and does not wait for the command result.
- **ACT-4** The editor has a "Send test" button for the selected hotspot's command. The server
  sends it exactly as if the hotspot had been tapped, so commands can be checked during setup
  without the tablet.

### 5.6 Targets and drivers

- **TGT-1** The integrator manages a list of named targets.
- **TGT-2** Supported protocols:
  - **OSC over UDP** — host, port; command = OSC address + arguments (int, float, string).
  - **UDP** — host, port; command = text string.
  - **HTTP** — base URL; command = method (GET/POST/PUT), path, optional body.
- **TGT-3** Every driver implements one common interface, so a new protocol can be added without changing the rest of the system.
- **TGT-4** Every sent command and every delivery error is recorded in a command log visible in the editor.
  Each entry names its source: the station that tapped, or "Test" for a send from the editor (ACT-4).
- **TGT-5** Delivery status: OSC over UDP and UDP report *sent* when the packet leaves the server
  and *error* only when sending fails locally (e.g. the host cannot be resolved) — UDP cannot
  confirm arrival. HTTP reports *error* on a non-2xx response or after a 2-second timeout.

### 5.7 Stations

- **ST-1** The integrator manages stations: name, start page, idle timeout (seconds, or off).
- **ST-2** A tablet opens a station by URL: `/play/<station-id>`.
- **ST-3** Any number of tablets can open the same station (duplicate or backup tablets).
- **ST-4** After the idle timeout with no taps, the player returns to the station's start page.
- **ST-5** Taps from different tablets are not coordinated: each tap sends its command; the last one wins on the media server.
- **ST-6** The editor shows each station's URL, built from the server's local network address, and a QR code that opens it, so a tablet is set up by scanning instead of typing an IP address.

### 5.8 Player

- **PLY-1** Renders the station's pages exactly as in the editor, scaled by the canvas scale mode.
- **PLY-2** Shows an unobtrusive indicator when the connection to the server is lost; hides it when restored.
- **PLY-3** Reconnects to the server automatically. Taps made while disconnected are queued
  for up to 5 seconds and sent on reconnect; older ones are dropped, so a late reconnect never
  starts content the visitor has already moved on from.
- **PLY-4** Requests a screen wake lock where the browser offers one. On iPad over `http://` it
  does not, so staying awake is a stand-setup step described in the setup guide
  ([ADR 0015](adr/0015-screen-wake.md)).
- **PLY-5** Applies project changes saved in the editor without a manual reload.
- **PLY-6** If the current page no longer exists after an update, returns to the start page.
- **PLY-7** Prevents accidental zoom, text selection and context menus.

### 5.9 Editor

- **ED-1** No authentication in MVP: anyone on the local network can open the editor (see [§8](#8-assumptions-and-constraints)).
- **ED-2** Renders pages with the same component as the player, with a selection layer on top.
- **ED-3** Safe area: for a chosen reference screen (16:10 1280×800 or 16:9 1920×1080; an editor
  preference, not saved in the project), the editor can mark the parts of the page that `fill`
  mode crops. In `fill` mode, a hotspot that reaches into a cropped band is flagged on the canvas
  and in its properties, with how much is cropped — even when the safe-area marks are hidden.
- **ED-8** The canvas is always scaled to fit the available space; the editor shows the current
  scale as a percentage. No manual zoom or panning in MVP.
- **ED-4** Provides management of pages, hotspots, targets, stations and canvas settings.
- **ED-5** Saves changes to the server; saved changes reach open players (see PLY-5).
- **ED-6** Shows the command log (TGT-4).
- **ED-7** Shows the editor's own connection to the server (connected / disconnected) and the
  save status (saving / saved / save error). Per-target reachability is not shown (TGT-5).

### 5.10 Demo receiver

- **DEMO-1** Accepts HTTP requests on `/demo/<screen>/<content>` and shows them as a live log,
  plus one tile per screen name with the content it last received (e.g. `POST /demo/screen-1/product-a`
  → tile "screen-1" shows "product-a"). The request body is shown in the log, not on the tiles.
- **DEMO-2** Ships with a demo project that targets the demo receiver, so the full flow works out of the box.
- **DEMO-3** A demo mode (server start flag) makes a public online demo safe:
  - the editor is fully usable, but changes live only in the visitor's browser tab and are gone after a reload — every visitor starts from the original demo project;
  - the server rejects saving, file uploads and project import;
  - commands are delivered only to the demo receiver, whatever the targets say;
  - the editor shows a permanent "Demo mode — changes are not saved" notice.

## 6. Screens and user flows

### 6.1 Screens

| Screen | Used by | Purpose |
|---|---|---|
| Editor — Pages | Integrator | Page list, canvas with hotspots, properties panel |
| Editor — Targets | Integrator | Manage command destinations |
| Editor — Stations | Integrator | Manage stations, their URLs and QR codes |
| Editor — Settings | Integrator | Canvas size and scale mode, import/export |
| Editor — Command log | Integrator | Sent commands and errors |
| Player | Visitor | Full-screen station, nothing else |
| Demo receiver | Reviewer | Live log of received commands |

### 6.2 Flows

**F1. Build a stand from scratch (integrator)**
1. Opens the editor, sets the canvas size and scale mode.
2. Adds a target, e.g. "Resolume" (OSC over UDP, IP, port).
3. Creates pages and uploads a background for each.
4. Adds hotspots over the drawn buttons, makes them invisible, chooses a press effect.
5. Sets each hotspot's action: go to a page and/or send a command.
6. Creates a station with a start page and idle timeout.
7. Scans the station's QR code with the tablet and adds the page to the home screen.

**F2. Visitor interaction**
1. Visitor sees the start page (possibly a video background).
2. Taps a hotspot: press effect plays, command is sent, page changes.
3. Content appears on the stand screens (handled by the media server).

**F3. Visitor walks away**
1. No taps for the idle timeout.
2. Player fades back to the start page.

**F4. Live adjustment during setup**
1. Integrator moves a hotspot in the editor and saves.
2. Tablets on the stand show the change within a second, without reload.

**F5. Network drop**
1. Tablet loses Wi-Fi: the connection indicator appears.
2. Taps still navigate between pages; their commands wait in a 5-second queue (PLY-3).
3. Wi-Fi returns: player reconnects, sends the commands still in the queue, indicator disappears.

**F6. Demo without hardware (reviewer)**
1. Starts Tapcue with one command; the demo project is loaded.
2. Opens the player in one tab and the demo receiver in another.
3. Taps in the player and sees the commands arrive in the receiver.

The same flow works on the public online demo (DEMO-3) without installing anything.

## 7. Non-functional requirements

- **NFR-1 Platforms.** Player: Safari on iPadOS and Chrome (desktop and Android), latest two major versions. Editor: desktop Chrome, Safari, Firefox, latest two major versions.
- **NFR-2 Latency.** From tap to command leaving the server: under 100 ms on a local network.
- **NFR-3 Reliability.** Runs for a full exhibition day (10 h) without restart; recovers from network drops without human action.
- **NFR-4 Network.** Works on a local network with no internet access.
- **NFR-5 Security.** No authentication in MVP. The server is intended for trusted local networks only, and the README states this clearly.
- **NFR-6 Server platforms.** macOS and Windows; started with a single command.
- **NFR-7 Code quality.** Type-checked, linted and tested in CI; every module has a single, explainable responsibility.

## 8. Assumptions and constraints

- One server runs one project. Several stands need several server instances.
- The media server owns all show logic; Tapcue does not know what is playing.
- Tablets and the server are on the same local network; the network is trusted. Anyone on it can open the editor — on a stand this network is typically a dedicated access point, not the venue Wi-Fi.
- Artwork is prepared to the canvas size by a designer.

## 9. Out of scope for MVP (planned later)

- Undo/redo in the editor (the architecture must allow adding it).
- Manual zoom and panning on the editor canvas.
- Editor password.
- A command sent when a station returns to its start page after the idle timeout.
- Image-based hotspot states (a separate "pressed" image).
- OSC over TCP, raw TCP.
- Command templates for QLab and Resolume.
- Idle ("attract") animations, more transitions and press effects, polygon hotspots.
- Import from Figma.
- Feedback from media servers (what is currently playing).

## 10. Open questions

None at the moment. Video autoplay, screen wake lock and tap latency on iPad were checked by a
technical spike: see [spike-ipad.md](spike-ipad.md).

## Appendix A. Recommended media

Backgrounds are played by the browser on the tablet (`<video muted loop playsinline>`), so
media must suit a mobile browser, not a media server.

| | Images | Video |
|---|---|---|
| **Format** | JPEG for photos, PNG for flat graphics with sharp edges, WebP for both | MP4, H.264 video, no audio track |
| **Resolution** | Exactly the canvas size | The canvas size or smaller (e.g. 1920×1080); never above 4K |
| **Other** | Export at 80–90% quality | 25 or 30 fps, 5–10 Mbit/s, short keyframe interval, `faststart` |
| **Typical size** | 0.3–2 MB | 30 s loop ≈ 20–40 MB |

Why:
- **H.264, not HEVC/ProRes.** It is the only codec every target browser decodes in hardware.
- **No audio.** Browsers only autoplay muted video; an unused audio track wastes space.
- **`faststart`.** Puts the file index at the beginning so playback starts before the file is fully loaded.
- **Seamless loops.** The last frame should match the first; browsers may pause briefly at the loop point otherwise.
- **200 MB limit.** Every tablet downloads each file over the stand's Wi-Fi; large files slow setup and use tablet memory without visible benefit.

Example conversion:

```bash
ffmpeg -i input.mov -c:v libx264 -preset slow -crf 20 -vf "scale=1920:-2,fps=30" \
  -g 30 -an -movflags +faststart output.mp4
```
