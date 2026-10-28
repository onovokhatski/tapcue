# Design

Design phase: **done** (design v1.2, 2026-10-29).

| File | Content |
|---|---|
| [tokens.css](tokens.css) | **Source of truth for design tokens**: primitives and semantic colours, type, spacing, radii, elevation, focus, motion |
| [components.md](components.md) | Component inventory: variants, states, props; components per screen; state coverage |
| [design-system.md](design-system.md) | Usage rules for foundations and components (written for v0.1, still valid) |
| [tailwind.config.js](tailwind.config.js) | Tailwind v3 mapping of every utility to a token; ported to Tailwind v4 `@theme` in M0 |
| [brand/](brand/) | App icon (iPad home screen, PWA, maskable), favicon, horizontal logo for light and dark backgrounds |
| [prototype/](prototype/) | HTML/Tailwind prototype from Claude Design. Open `prototype/dist/index.html` in a browser |
| [claude-design-prompts.md](claude-design-prompts.md) | Prompts used to produce the design |

## How the design was made

1. **Screen map** — every screen, who uses it, what it must show (`prototype/dist/process-map.html`).
2. **Wireframes** — low-fidelity layout of every screen (`prototype/dist/process-wireframes.html`).
3. **Design system** — tokens and components with all states, contrast checked (`design-system.html`).
4. **Screens** — Pages editor, Targets, Stations, Settings, Player, Demo receiver, each in all states.
5. **Review and handoff** — one-off audit, state coverage, contrast, editor breakpoints (`review.html`).

Steps 1–2 were first done in Figma ([Tapcue](https://www.figma.com/design/ZpELGgW46yI9guy8GTmJBX))
and later recreated in the prototype; the Figma tokens and components are superseded by this folder.
Published versions of the prototype pages are listed in `prototype/artifact-links.json`.

The prototype is a **visual reference**, not production code: the React components are written
from scratch in the implementation phase, using the same tokens and the inventory above.
