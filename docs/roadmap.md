# Tapcue — Roadmap

Status: **draft** · Last updated: 2026-11-19 · Requirements: [spec.md](spec.md)

## 1. Phases

```
Documentation ──▶ Spike ──▶ Design ──▶ M0 ──▶ M1 ──▶ M2 ──▶ M3 ──▶ M4 ──▶ M5 ──▶ v0.1.0
   (now)                               └──────────── implementation ────────────┘
```

Documents stay alive: when a later phase shows that an earlier decision was wrong, the
document is updated in the same pull request as the change, with an ADR if the decision
was significant.

## 2. How work is done

- **Milestones.** Every phase below is a GitHub Milestone.
- **Issues.** Every step is a GitHub Issue: what, why, requirement IDs from the spec, and
  acceptance criteria.
- **Branches.** One branch per issue: `<type>/<issue-number>-<short-name>`,
  e.g. `feat/14-osc-encoder`.
- **Commits.** [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- **Pull requests.** One PR per issue, linked with `Closes #N`, reviewed before merge,
  squash-merged into `main`. `main` is always green.
- **Small steps.** A PR does one thing and can be read in a few minutes.

### Definition of Done (every PR)

- [ ] CI is green: type check, lint, tests, build.
- [ ] New logic has tests; bug fixes have a test that failed before the fix.
- [ ] Docs are updated if behaviour or the project format changed.
- [ ] The PR description says what changed, why, and how it was checked.

## 3. Spike — technical risks

A short throw-away experiment before design, to make sure the riskiest assumptions hold.
The code is not kept; the conclusions go into ADRs.

**Done 2026-10-27** — results in [spike-ipad.md](spike-ipad.md).

| Question | Why it matters | Pass if |
|---|---|---|
| Does a muted looped video autoplay on iPad Safari from a home-screen page? | Video backgrounds (PG-3) | Plays without a tap, loops without a visible gap |
| Does the Screen Wake Lock API keep an iPad awake in that mode? | Stand runs all day (PLY-4) | Screen stays on for 30 min |
| How long from tap to UDP packet on a local network? | NFR-2 | Under 100 ms at the 95th percentile |
| Does a page change show a blank frame when switching between video backgrounds? | PG-5 | No blank frame with the planned preloading |

## 4. Design

| Deliverable | Content |
|---|---|
| Screen map | All screens from [spec §6.1](spec.md#61-screens) and how they connect |
| Wireframes | Every screen, plus flows F1–F6 step by step |
| Design tokens | Colours, typography, spacing scale — later the Tailwind theme |
| Visual mock-ups | Key screens in all states: empty, loading, error, selected |
| Component inventory | Every UI component with its purpose and states — the input for M1–M4 issues |

*Done when:* every screen and state in the spec has a mock-up and every mock-up is built
from components in the inventory.

**Done 2026-10-28**, completed in v1.2 on 2026-10-29 (editor breakpoints, app icon, process pages) — design in [docs/design/](design/README.md): tokens, component inventory,
prototype of every screen and state.

## 5. Implementation milestones

Each milestone ends with something that can be shown.

### M0 — Foundation

Repository, npm workspaces, TypeScript, ESLint, Prettier, Vitest, GitHub Actions.
Project schema in `shared` exactly as in [project-format.md](project-format.md).
Hand-written demo project with test assets.

- **Requirements:** PRJ-2, NFR-7
- **Done when:** CI is green; the demo project passes validation; invalid example projects fail with the expected error paths.

### M1 — Player (view only)

Server loads the project and serves it with its assets. Player renders a station: backgrounds
(image and video), `fit`/`fill`, hotspot shapes and styles, press effects, navigation with
a fade that waits for the next background, idle timeout. Check the player on a real iPad
([ipad-check.md](ipad-check.md)).

- **Requirements:** PRJ-1, CNV-1…3, PG-2…5, HS-3…5, ACT-3, ST-2, ST-4, PLY-1, PLY-7, PLY-8
- **Done when:** the demo project can be browsed in a browser like a real catalogue.

### M2 — Commands

WebSocket, dispatcher, the three drivers, command log, demo receiver, connection
indicator and automatic reconnect in the player.

- **Requirements:** ACT-1, ACT-2, TGT-2…6, ST-3, ST-5, PLY-2, PLY-3, DEMO-1, DEMO-2, NFR-2
- **Done when:** a tap in the player appears in the demo receiver; the OSC encoder is tested byte by byte; pulling the network cable and plugging it back restores the player without a reload.

### M3 — Editor: core

Editor layout, page list, uploads, page backgrounds, add / select / move / resize hotspots,
numeric position fields, stacking order, safe-area overlay, auto-save, live update of
players, command log panel.

- **Requirements:** PG-1, PG-6, HS-1, HS-2, HS-6, HS-7, ED-8, ED-1, ED-2, ED-3, ED-5, ED-6, ED-7, ED-9, ED-11, ED-12, PLY-5, PLY-6
- **Done when:** the demo project's pages can be rebuilt from scratch in the editor, and an open player follows every change within a second.

### M4 — Editor: complete

Editing of hotspot style, effect and action, with "Send test"; targets; stations with URLs and QR codes;
canvas settings; zip export and import. (The command log view moved to M3: it is the log panel.)

- **Requirements:** HS-4, HS-5, ACT-4, ED-10, TGT-1, ST-1, ST-6, ED-4, PRJ-3, PRJ-4, CNV-1, CNV-2
- **Done when:** everything in the project format can be edited in the editor; a project exported on one machine runs after import on another.

### M5 — Reliability and showcase

Screen wake lock, stand setup guide (Auto-Lock, Guided Access, dedicated access point),
end-to-end tests, testing on real iPads incl. home-screen mode and Guided Access, error states polish,
single-command start on macOS and Windows, a click-to-run app for both
([ADR 0017](adr/0017-click-to-run-app.md)), README with screenshots and a short video,
demo mode and a public online demo.

- **Requirements:** PLY-4, DEMO-3, NFR-1, NFR-3, NFR-5, NFR-6
- **Done when:** a person new to the project understands it from the README in five minutes and runs it with one command or one click; the player runs for 10 hours on an iPad without intervention.

**Release v0.1.0** — tagged after M5.

### v0.2 — Hotspot content

Hotspots carry their own visuals on top of the artwork: a frosted backdrop, a background image and
text ([ADR 0019](adr/0019-hotspot-content.md)), so a stand's button labels change in the editor
instead of the design tool. Also: number fields that change by dragging their label.

- **Requirements:** HS-8, HS-9, HS-10
- **Done when:** a stand's buttons can be labelled and styled in the editor without re-exporting the
  artwork, and the player shows them identically on an iPad, also over a video background, without
  stutter.

### v0.3 — Faders

Besides buttons, a hotspot can be a fader that sends a value while it is dragged
([ADR 0020](adr/0020-faders.md)). The value is held by the Tapcue server and shared by every
tablet; feedback from media servers stays out of scope.

- **Requirements:** FD-1 to FD-7
- **Done when:** a fader on an iPad changes a Resolume layer's opacity smoothly over OSC, two
  tablets show the same position, and the editor sets a fader up without code.

### v0.4 — Project library

One server keeps several stands and runs one of them; the editor's Projects tab creates, opens and
deletes them ([ADR 0021](adr/0021-project-library.md)).

- **Requirements:** PRJ-1, PRJ-5 to PRJ-8
- **Done when:** a new stand is started, opened on every tablet and an old one deleted from the
  editor, without touching the file system or restarting the server.

### v0.5 — Command sequences

A tap sends several commands one after another, each with an optional delay before it, to the
same or different targets ([ADR 0022](adr/0022-command-sequences.md)). The server runs the
sequence; a new tap on the same hotspot starts it over.

- **Requirements:** ACT-1, ACT-4 to ACT-8, TGT-4
- **Done when:** one button on an iPad starts a Resolume clip and, 2.5 seconds later, a QLab cue;
  the editor sets this up in seconds without code; projects from 0.4.0 open unchanged.

### v0.6 — Editor tidy-up

The editor gets out of the way on a busy stand: the page list and command cards fold away,
commands have names and an on/off switch, hotspots get unique names, and several hotspots are
selected, copied to another page, aligned, distributed and edited together.

- **Requirements:** ED-13 to ED-19, ACT-9
- **Done when:** a page of 20 buttons is laid out in a grid, renamed and given a common style in
  a minute; a set of buttons is copied to another page in two keystrokes; a sequence's steps are
  named and switched off without deleting them.

### v0.7 — Properties panel

The hotspot panel reads at a glance: every section folds and sums up its state in one line, the
sections go from how a hotspot looks to what it does, position values fit their fields, and
"Go to page" is one of the commands.

- **Requirements:** ED-20 to ED-23
- **Decided** (2026-11-24): Go to page changes only the editor, not the project format; the
  order is Name, Type, Position and size, Style, Text, On tap, Stacking; one set of folded
  sections for every hotspot, kept in the browser; done before undo/redo.
- **Done when:** with every section folded, the panel of a hotspot fits a 900 px-high window
  and still says its size, style, text and what a tap does; a page link is added from Add
  command; 2048 and 1536 show in full in the position fields.

### v0.8 — Undo and redo

A wrong drag, delete or paste is one keystroke from undone.

- **Requirements:** ED-24 to ED-27 ([ADR 0023](adr/0023-undo-history.md))
- **Decided** (2026-11-24): the history lasts while the tab is open, 100 steps; a save from
  another editor clears it; a drag, a series of nudges or typing into one field is one step.
- **Done when:** a hotspot dragged across the page, renamed and deleted comes back in three
  presses of Cmd + Z, on the editor and on every open tablet; Shift + Cmd + Z brings the changes
  back.

### v0.9 — Web backgrounds

A page can show a live site, with the stand's own hotspots on top.

- **Requirements:** PG-7 to PG-10 ([ADR 0024](adr/0024-web-backgrounds.md))
- **Decided** (2026-11-25): an online address or a mini-site uploaded as a .zip; the site loads
  afresh on every visit; on such a page the idle return uses a project-wide web page time
  (Settings tab), from opening for an online site and from the last tap for a mini-site.
- **Done when:** a mini-site uploaded as a page background in the editor appears on the open
  tablet within a second; a link inside it works; a hotspot over it goes to another page; and
  after the web page time the tablet is back on the station's start page. An online address that
  forbids embedding is refused in the editor with the reason.

## 6. After MVP

Each becomes its own milestone when started.

**Next, in this order** (set on 2026-11-23; undo/redo became v0.8 on 2026-11-24, web backgrounds
v0.9 on 2026-11-25):

1. Image-based hotspot states (a "pressed" image)
2. Idle ("attract") animations, more press effects and transitions

**Later:**

- OSC over TCP and raw TCP drivers
- Command templates for QLab and Resolume
- Editor password
- Polygon hotspots
- Import from Figma
- Feedback from media servers (what is currently playing)

## 7. Open questions

- **Online demo hosting** (M5): decided — Railway, built from a Dockerfile ([ADR 0018](adr/0018-online-demo-on-railway.md)).
- **Design tool** (Design phase): Figma, Claude Design or HTML prototypes. Decided before
  the design phase starts.
