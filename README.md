<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/design/brand/tapcue-logo-dark.svg">
    <img src="docs/design/brand/tapcue-logo-light.svg" alt="Tapcue" width="280">
  </picture>
</p>

# Tapcue

**Beautiful touch interfaces for exhibition stands, wired to your media server.**

> **Status:** pre-implementation — no code yet. The specification, architecture, decisions,
> technical spike and design are complete; implementation starts with milestone M0.
> See the [roadmap](docs/roadmap.md) and the [design](docs/design/README.md).

<!-- Screenshot / short video of the editor and player goes here (milestone M5). -->

## What it is

An exhibition stand often has a large screen, a few smaller ones, and a tablet for visitors.
Tapping something on the tablet should bring up related content on the screens, which are
driven by a media server such as QLab or Resolume.

Tapcue lets an integrator turn designer-made artwork into that tablet interface in an evening:

1. Upload the designer's images or video loops as pages.
2. Place hotspots over the drawn buttons — invisible, or styled with a press effect.
3. Make each hotspot open another page, send a command to the media server, or both.
4. Scan a QR code with the tablet. Done.

All show logic stays on the media server; Tapcue only provides the interface and delivers
the commands.

## How it works

```
 Tablet (browser)          Tapcue server (local network)          Media server
 ┌──────────────┐  tap    ┌─────────────────────────────┐  OSC   ┌────────────┐
 │    Player    │────────▶│ finds the hotspot's action, │───────▶│ QLab,      │
 └──────────────┘         │ sends its command           │  UDP   │ Resolume,  │
 ┌──────────────┐  edit   │                             │  HTTP  │ ...        │
 │    Editor    │────────▶│ stores the project, pushes  │        └────────────┘
 └──────────────┘         │ updates to all tablets      │
                          └─────────────────────────────┘
```

- Runs entirely in the stand's local network — no internet, no accounts, no installation on tablets.
- One server, any number of tablets, each with its own interface if needed.
- Commands: OSC over UDP, raw UDP, HTTP.

## Planned for v0.1

- Pages with image or looping video backgrounds, `fit` / `fill` scaling
- Rectangle and ellipse hotspots, styles, press effects, fade transitions
- Stations: separate entry points for different tablets, with idle return to the start page
- Editor with live update of every open tablet
- Station URLs as QR codes
- Built-in demo receiver and demo project — try everything without any hardware
- Public online demo

The full list is in the [specification](docs/spec.md).

## Documentation

| Document | Content |
|---|---|
| [Specification](docs/spec.md) | What Tapcue does: requirements, screens, user flows |
| [Architecture](docs/architecture.md) | How it is built: packages, modules, protocols, reliability |
| [Project format](docs/project-format.md) | The `project.json` reference |
| [Roadmap](docs/roadmap.md) | Phases, milestones and how work is done |
| [Decisions](docs/adr/README.md) | Architecture decision records |

## Tech stack

TypeScript · React · Vite · Zustand · Tailwind CSS · Node.js · Fastify · WebSocket · Zod ·
Vitest · Playwright · GitHub Actions

## Security

Tapcue is designed for a **trusted local network**, such as a stand's own access point. In
v0.1 the editor has no password: anyone on the network can change the project. Do not
expose a Tapcue server to the internet except in demo mode.

## Getting started

*Available from milestone M1.*

## Development

Requirements: Node.js 22 LTS or newer (`.nvmrc` pins the version used in CI) and npm 10.

```bash
npm install
```

| Command | What it does |
|---|---|
| `npm run typecheck` | Type-checks every package (TypeScript, strict mode) |

The repository is an npm workspace with three packages:

| Package | Responsibility |
|---|---|
| `packages/shared` | Project format and message schemas, shared types |
| `packages/server` | Project storage, HTTP API, WebSocket, command drivers |
| `packages/web` | Editor, player and demo receiver |

`server` and `web` depend only on `shared`, never on each other
([ADR 0002](docs/adr/0002-npm-workspaces.md)).

## License

[MIT](LICENSE) © Oleg Novokhatskyi
