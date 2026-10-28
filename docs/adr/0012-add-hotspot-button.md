# 0012. "Add hotspot" button instead of a drawing mode

Status: Accepted · Date: 2026-10-25

## Context
Hotspots must be created, moved and resized. Graphic editors usually offer a drawing tool:
press, drag, release.

## Decision
An "Add hotspot" button creates a hotspot with a default size in the centre of the page; it
is then moved and resized with handles or positioned precisely with numeric fields.

## Alternatives considered
- **Drawing mode.** Slightly faster for creating many hotspots, but adds a separate editor
  mode ("drawing" vs "selecting") with its own state, cursor and edge cases.

## Consequences
- The editor has one interaction mode; move and resize are needed anyway.
- Creating a hotspot takes one extra drag compared to drawing.
