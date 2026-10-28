# Design

Design phase: **done** (design v1.0, 2026-10-28).

| File | Content |
|---|---|
| [tokens.css](tokens.css) | **Source of truth for design tokens**: primitives and semantic colours, type, spacing, radii, elevation, focus, motion |
| [components.md](components.md) | Component inventory: variants, states, props; components per screen; state coverage |
| [design-system.md](design-system.md) | Usage rules for foundations and components (written for v0.1, still valid) |
| [tailwind.config.js](tailwind.config.js) | Tailwind v3 mapping of every utility to a token; ported to Tailwind v4 `@theme` in M0 |
| [prototype/](prototype/) | HTML/Tailwind prototype from Claude Design. Open `prototype/dist/*.html` in a browser: design system, every screen with its states, review and handoff |
| [claude-design-prompts.md](claude-design-prompts.md) | Prompts used to produce the design |

The prototype is a **visual reference**, not production code: the React components are written
from scratch in the implementation phase, using the same tokens and the inventory above.

The earlier Figma file ([Tapcue](https://www.figma.com/design/ZpELGgW46yI9guy8GTmJBX)) holds the screen map
and wireframes. Its tokens and components are superseded by this folder.
