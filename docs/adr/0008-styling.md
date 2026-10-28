# 0008. Tailwind for app UI, CSS variables and keyframes for hotspots

Status: Accepted · Date: 2026-10-25

## Context
Tapcue has two kinds of styles: the interface of the app itself (editor panels, forms,
lists), and hotspot styles defined by the user in `project.json` (colours, borders,
radius, opacity), known only at runtime. Press effects and transitions are animations.

## Decision
- **App UI:** Tailwind CSS, with design tokens from the design phase as its theme.
- **Hotspot styles:** CSS custom properties and inline styles set from project data.
- **Press effects and transitions:** plain CSS with `@keyframes`, driven by those custom properties.

## Alternatives considered
- **CSS Modules for everything.** Plain CSS, cleaner markup; but no built-in spacing and
  colour scale, and less common in job postings.
- **CSS-in-JS** (styled-components, Emotion). Runtime cost and declining popularity.

## Consequences
- Consistent spacing and colours in the UI without a separate design system library.
- User-defined styles stay data, not generated class names.
- Two styling techniques in the codebase, each with a clear, separate job.
