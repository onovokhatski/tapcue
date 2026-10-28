# 0011. Auto-save with whole-project PUT

Status: Accepted · Date: 2026-10-25

## Context
During setup the integrator adjusts hotspots while tablets on the stand must follow
([spec F4](../spec.md#62-flows)). A forgotten "Save" click means the stand shows old content.

## Decision
The editor saves automatically shortly after the last change (debounced) by sending the
whole project in one `PUT /api/project`. The editor shows "Saving… / Saved / Error".

## Alternatives considered
- **Explicit Save button.** Familiar, but easy to forget on a busy stand.
- **Fine-grained patches** (JSON Patch, CRDT). Needed for collaborative editing; for one
  editor and a few kilobytes of JSON they only add complexity.

## Consequences
- Tablets always reflect the latest edit.
- Every save is validated as a whole; partial invalid states never reach the disk.
- With two editors open, the last save wins.
