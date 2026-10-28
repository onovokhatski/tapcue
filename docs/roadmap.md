# Tapcue — Roadmap

Status: **draft** · Last updated: 2026-10-25 · Requirements: [spec.md](spec.md)

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
fade and warm pages, idle timeout. Measure on a real iPad how many videos can stay warm at
once.

- **Requirements:** PRJ-1, CNV-1…3, PG-2…5, HS-3…5, ACT-3, ST-2, ST-4, PLY-1, PLY-7
- **Done when:** the demo project can be browsed in a browser like a real catalogue.

### M2 — Commands

WebSocket, dispatcher, the three drivers, command log, demo receiver, connection
indicator and automatic reconnect in the player.

- **Requirements:** ACT-1, ACT-2, TGT-2…5, ST-3, ST-5, PLY-2, PLY-3, DEMO-1, DEMO-2, NFR-2
- **Done when:** a tap in the player appears in the demo receiver; the OSC encoder is tested byte by byte; pulling the network cable and plugging it back restores the player without a reload.

### M3 — Editor: core

Editor layout, page list, uploads, page backgrounds, add / select / move / resize hotspots,
numeric position fields, stacking order, safe-area overlay, auto-save, live update of
players.

- **Requirements:** PG-1, PG-6, HS-1, HS-2, HS-6, ED-1, ED-2, ED-3, ED-5, ED-7, PLY-5, PLY-6
- **Done when:** the demo project's pages can be rebuilt from scratch in the editor, and an open player follows every change within a second.

### M4 — Editor: complete

Editing of hotspot style, effect and action, with "Send test"; targets; stations with URLs and QR codes;
canvas settings; command log view; zip export and import.

- **Requirements:** HS-4, HS-5, ACT-4, TGT-1, ST-1, ST-6, ED-4, ED-6, PRJ-3, PRJ-4, CNV-1, CNV-2
- **Done when:** everything in the project format can be edited in the editor; a project exported on one machine runs after import on another.

### M5 — Reliability and showcase

Screen wake lock, stand setup guide (Auto-Lock, Guided Access, dedicated access point),
end-to-end tests, testing on real iPads incl. home-screen mode and Guided Access, error states polish,
single-command start on macOS and Windows, README with screenshots and a short video,
demo mode and a public online demo.

- **Requirements:** PLY-4, DEMO-3, NFR-1, NFR-3, NFR-5, NFR-6
- **Done when:** a person new to the project understands it from the README in five minutes and runs it with one command; the player runs for 10 hours on an iPad without intervention.

**Release v0.1.0** — tagged after M5.

## 6. After MVP

In order of value; each becomes its own milestone when started.

1. Undo / redo in the editor
2. Image-based hotspot states (a "pressed" image)
3. OSC over TCP and raw TCP drivers
4. Command templates for QLab and Resolume
5. Editor password
6. Idle ("attract") animations, more press effects and transitions
7. Polygon hotspots
8. Import from Figma
9. Feedback from media servers (what is currently playing)

## 7. Open questions

- **Online demo hosting** (M5): which hosting service runs the demo-mode server. Decided before M5.
- **Design tool** (Design phase): Figma, Claude Design or HTML prototypes. Decided before
  the design phase starts.
