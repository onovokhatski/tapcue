# 0004. One page renderer for player and editor

Status: Accepted · Date: 2026-10-25

## Context
The integrator places hotspots in the editor; the visitor sees them in the player. Any
difference in rendering (scaling, rounding, shapes) means hotspots that look right in the
editor are misplaced on the tablet.

## Decision
A single React component, `PageView`, renders a page at canvas size and scales it with a CSS
transform. The player uses it directly; the editor puts a selection layer on top of the same component.

## Alternatives considered
- **A separate editor canvas** (e.g. with Konva or the Canvas API). Better for heavy graphic
  editing, but two renderers must be kept identical forever.

## Consequences
- What the editor shows is, by construction, what the player shows.
- Press effects and backgrounds are implemented once.
- The editor is DOM-based; performance is fine for the expected dozens of hotspots per page.
