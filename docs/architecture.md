# Tapcue — Architecture

Status: **draft** · Last updated: 2026-10-25 · Requirements: [spec.md](spec.md)

This document describes how Tapcue is built: its parts, how they talk to each other and why
it is shaped this way. Terms (Page, Hotspot, Station, …) are defined in
[spec.md §4](spec.md#4-concepts).

## 1. System context

```
                     Local network of the stand
 ┌───────────────────────────────────────────────────────────────┐
 │                                                               │
 │   Tablet(s)                 Tapcue server              Media  │
 │  ┌──────────┐  WebSocket  ┌──────────────┐  OSC/UDP  ┌──────┐ │
 │  │  Player  │◀───────────▶│              │──────────▶│QLab, │ │
 │  └──────────┘             │   Node.js    │   UDP     │Resol-│ │
 │                           │              │   HTTP    │ume...│ │
 │  Integrator's browser     │  project/    │           └──────┘ │
 │  ┌──────────┐  HTTP + WS  │  folder      │                    │
 │  │  Editor  │◀───────────▶│              │                    │
 │  └──────────┘             └──────────────┘                    │
 └───────────────────────────────────────────────────────────────┘
```

- **Browsers cannot send UDP**, so every command goes through the server.
- **The server is the only owner of the project.** Editor and players hold copies and get updates from it.
- **No internet, no database, no accounts.** Everything lives on one machine in the local network.

## 2. Packages

The repository is an npm workspace with three packages:

```
packages/
  shared/   project schema, message schemas, shared types
  server/   project storage, HTTP API, WebSocket, drivers
  web/      editor, player and demo receiver (one React app)
```

| Package | Responsibility | May depend on |
|---|---|---|
| `shared` | Defines the project format and the messages between browser and server — once, for everyone | nothing (only Zod) |
| `server` | Stores the project, serves the web app, delivers commands | `shared` |
| `web` | Everything a person sees | `shared` |

**Dependency rule:** `web` and `server` never import from each other; they agree only
through `shared`. If the format changes, the type checker shows every place on both sides
that must follow.

## 3. Server

```
server/src/
  main.ts            start-up: read config, wire modules together, listen
  config.ts          port, project folder path, demo mode (from CLI args / env)
  project/
    store.ts         load, validate and atomically save project.json; keep revision
    assets.ts        save uploaded files into assets/, enforce the 200 MB limit
    archive.ts       zip export / import
  http/
    routes.ts        REST endpoints (see §5.1)
  realtime/
    hub.ts           WebSocket connections: players and editors, broadcast
  commands/
    dispatcher.ts    tap → find hotspot action → pick driver → send → log
    log.ts           in-memory ring buffer of the last 500 log entries
    drivers/
      driver.ts      the common Driver interface
      osc-udp.ts
      udp.ts
      http.ts        adds X-Tapcue-Station / X-Tapcue-Hotspot, 2 s timeout
      osc-encode.ts  OSC message encoder (pure function)
  network.ts         local IP addresses for station URLs / QR codes
  demo/
    receiver.ts      endpoint that records incoming HTTP commands
```

Each module has one job, described in one line above. Modules receive their dependencies
as arguments (created in `main.ts`), not by importing singletons — this keeps them testable
in isolation.

### The Driver interface

```ts
interface Driver<T extends Target> {
  send(target: T, command: CommandFor<T>): Promise<void>; // throws on delivery error
  close(): Promise<void>;
}
```

The dispatcher chooses a driver by `target.protocol` from a map. Adding a protocol means
writing one driver file and adding one line to that map ([spec TGT-3](spec.md#56-targets-and-drivers)).

## 4. Web app

One Vite + React app with three routes:

| Route | Who | What |
|---|---|---|
| `/play/:stationId` | Visitor | Full-screen player |
| `/edit` | Integrator | Editor |
| `/demo` | Reviewer | Demo receiver log |

```
web/src/
  stage/        PageView — renders one page at canvas size, scaled to the viewport
  player/       station runtime: navigation, idle timer, page transitions, wake lock
  editor/       editor screens, store and document operations
  demo/         demo receiver page
  lib/          API client, WebSocket client with reconnect
```

### 4.1 One renderer for player and editor

`PageView` draws a page — background and hotspots — inside a box of exactly canvas size,
then scales the whole box with a CSS `transform: scale()` to `fit` or `fill` the viewport.
Hotspots are absolutely positioned in canvas pixels, so they scale together with the
background and never drift.

The **player** uses `PageView` as is. The **editor** places the same `PageView` under a
selection layer (outlines, resize handles). What the integrator sees is, by construction,
what the visitor sees ([spec ED-2](spec.md#59-editor)).

### 4.2 Editor state

- A Zustand store holds the current `Project`, the selection and the save status.
- Every change to the project is a **pure function** `(project, args) => newProject`
  (e.g. `moveHotspot`, `addPage`), living in `editor/operations/` and unit-tested without React.
- The store never mutates the project; it replaces it. Undo/redo (post-MVP) then becomes a
  stack of previous projects — no redesign needed.
- Changes are **auto-saved** shortly after the last edit (debounced), and the editor shows
  "Saving… / Saved / Error". This supports live adjustment on the stand
  ([spec F4](spec.md#62-flows)) without a "Save" button that people forget.

### 4.3 Player runtime

- Holds the current page and an idle timer; any tap resets the timer
  ([spec ST-4](spec.md#57-stations)).
- **Load on tap** ([spec PG-5](spec.md#53-pages), [ADR 0016](adr/0016-load-next-page-on-tap.md)):
  only the page on screen and the incoming page are in the DOM. The incoming page's background
  starts loading on the tap, and the page stays invisible until its image is decoded or its
  video has its first frame — the player never swaps into an empty frame.
- **Transitions** fade the incoming page in on top of the current one, which stays opaque
  until the fade ends.
- Requests a **Screen Wake Lock** where available and re-requests it when the page becomes
  visible again; on iPad over `http://` staying awake is a stand-setup step
  ([ADR 0015](adr/0015-screen-wake.md)).
- Uses **feature detection** only — iPad Safari reports a desktop user agent.
- A tap fires on pointer release: the `tap` message is sent at once, the page change starts after
  the release effect (≤ 160 ms). Navigation is local; commands are fire-and-forget over WebSocket
  ([spec ACT-2, ACT-3](spec.md#55-actions)).

## 5. Communication

All message and payload shapes are Zod schemas in `shared`, so both sides validate the same
contract at runtime and get the same TypeScript types at compile time.

### 5.1 HTTP (editor ↔ server)

| Method & path | Purpose |
|---|---|
| `GET /api/project` | Current project and its revision |
| `PUT /api/project` | Replace the project (validated); returns the new revision |
| `POST /api/assets` | Upload a file (multipart) |
| `GET /assets/*` | Serve project files to editor and players |
| `GET /api/project/export` | Download the project as `.zip` |
| `POST /api/project/import` | Upload a `.zip` to replace the project |
| `GET /api/network` | Local addresses for station URLs / QR codes |
| `POST /api/test-send` | Send a hotspot's command from the editor (`pageId`, `hotspotId`; [spec ACT-4](spec.md#55-actions)) |
| `POST /demo/*` | Demo receiver endpoint |

The editor saves the **whole project** in one request. A project is a few kilobytes of JSON,
so this is simpler and safer than syncing fine-grained patches.

### 5.2 WebSocket (players and editors ↔ server)

One endpoint, `/ws`. Messages are JSON objects with a `type` field.

| Direction | Type | Payload | Meaning |
|---|---|---|---|
| player → server | `hello` | `stationId` | Identify after (re)connect |
| player → server | `tap` | `pageId`, `hotspotId` | A hotspot was tapped |
| server → all | `project-updated` | `revision` | Fetch the new project |
| server → editors | `log-entry` | entry (incl. source: station id or `test`) | A command was sent or failed |
| server → demo pages | `demo-received` | request summary | Demo receiver got a request |
| both | `ping` / `pong` | — | Detect dead connections |

**The player sends *which hotspot* was tapped, not *what command* to send.** The server looks
up the action in its own copy of the project. This keeps a single source of truth (a player
with a stale project cannot send an outdated command) and means a browser on the network
cannot ask the server to send arbitrary packets.

### 5.3 Key flows

**Tap → command**

```
Player                    Server                         Media server
  │  tap {page, hotspot}    │                                 │
  │────────────────────────▶│ dispatcher: find action         │
  │ (navigates immediately) │ driver = drivers[target.proto]  │
  │                         │ driver.send(target, command) ──▶│
  │                         │ log.add(sent | error)           │
  │                         │──▶ editors: log-entry           │
```

**Edit → live update**

```
Editor                    Server                         Players
  │ PUT /api/project        │                                 │
  │────────────────────────▶│ validate → save atomically      │
  │◀──── revision ──────────│ revision++                      │
  │                         │── project-updated {revision} ──▶│
  │                         │◀──────── GET /api/project ──────│
  │                         │                     re-render   │
```

## 6. Persistence

- The project folder is the only storage: `project.json` + `assets/`.
- **Atomic save:** write to a temporary file, then rename over `project.json`. A crash
  mid-write never leaves a broken project.
- A **revision** number in memory increments on every save; clients use it to know that
  their copy is stale.
- **Concurrent editors:** last save wins. One integrator per stand is assumed
  ([spec §8](spec.md#8-assumptions-and-constraints)).
- Uploaded files get a unique, sanitised name so uploads never overwrite each other.
  Unused files are not cleaned up in MVP.
- The command log is in memory only and is lost on restart; it is a diagnostic tool, not history.

### Demo mode

Demo mode ([spec DEMO-3](spec.md#510-demo-receiver)) needs almost no special code, because
the editor already changes its own copy of the project first and saves it second
(§4.2). In demo mode:

- the server answers `PUT /api/project`, `POST /api/assets` and the import endpoint with
  `403`, and the editor stops trying to save after learning the mode from `GET /api/project`;
- the dispatcher replaces every target with the demo receiver before choosing a driver.

These are three checks in the server and one flag in the editor — no separate demo build.

## 7. Reliability

| Failure | Behaviour |
|---|---|
| Tablet loses Wi-Fi | WebSocket closes → indicator shown → taps queued in the player, each kept for 5 s → reconnect with backoff (1 s, 2 s, 4 s … max 10 s) → `hello` → queued taps sent → fetch project if revision changed |
| HTTP target slow | Request aborted after 2 s → logged as an error |
| Silent dead connection | `ping` every 10 s; no `pong` within 5 s → treat as closed |
| Media server unreachable | Driver throws → error logged and shown in editor; the server keeps running |
| Invalid project on disk | Server refuses to start with a readable error pointing to the field |
| Invalid project from editor | `PUT` rejected with field errors; nothing is saved |
| Browser releases wake lock | Re-requested on `visibilitychange` |

No error in one tap, one driver or one connection may crash the server.

## 8. Testing strategy

| Layer | Tool | What is tested |
|---|---|---|
| `shared` schemas | Vitest | Valid and invalid projects, messages |
| OSC encoder | Vitest | Byte-exact output against known OSC packets |
| Drivers | Vitest | Against local UDP / HTTP test servers |
| Dispatcher, store | Vitest | With fake drivers and a temporary folder |
| Editor operations | Vitest | Pure functions, no React |
| Full flow | Playwright | Tap in player → entry in demo receiver; edit → player updates |

## 9. Decisions

Each significant decision is recorded as an ADR in [docs/adr/](adr/):

1. [Local server in the stand network instead of a cloud service](adr/0001-local-server.md)
2. [npm workspaces with three packages](adr/0002-npm-workspaces.md)
3. [Zod schemas in `shared` as the single source of truth](adr/0003-zod-schemas.md)
4. [One `PageView` renderer for player and editor](adr/0004-shared-page-renderer.md)
5. [Player sends hotspot references, not commands](adr/0005-player-sends-hotspot-refs.md)
6. [WebSocket for real-time messages, HTTP for documents and files](adr/0006-websocket-and-http.md)
7. [Own OSC encoder instead of a library](adr/0007-own-osc-encoder.md)
8. [Tailwind for app UI; CSS variables and keyframes for hotspot styles and effects](adr/0008-styling.md)
9. [Filesystem storage, no database](adr/0009-filesystem-storage.md)
10. [No authentication in MVP](adr/0010-no-auth-in-mvp.md)
11. [Auto-save with whole-project `PUT`](adr/0011-autosave-whole-project.md)
12. ["Add hotspot" button instead of a drawing mode](adr/0012-add-hotspot-button.md)
13. [Demo mode as a server flag](adr/0013-demo-mode.md)
14. [Warm next-page videos and fade-in on top](adr/0014-page-transitions.md) (superseded by 16)
15. [Screen wake is part of stand setup, not a player guarantee](adr/0015-screen-wake.md)
16. [Load the next page on tap, then fade it in on top](adr/0016-load-next-page-on-tap.md)
