# 0023. Undo history: snapshots of the immutable project

Status: Accepted · Date: 2026-11-24

## Context
The editor has no undo ([spec ED-24](../spec.md#59-editor)). A wrong drag, a deleted hotspot or a
pasted set in the wrong place is fixed by hand, and on a stand with a client watching that costs
minutes. Undo was planned from the start: the store never mutates the project but replaces it,
and every change is a pure function `(project) => project`
([architecture §4.2](../architecture.md#42-editor-state)).

Decided with the user on 2026-11-24: the history lasts while the editor tab is open, up to 100
steps; a save from another editor clears it; a drag, a series of arrow nudges or typing into one
field is one step.

## Decision
- **The history is a list of earlier projects.** Before a change replaces the project, the store
  keeps the project it replaces on a `past` stack; undo moves the current one to a `future` stack
  and puts the last of `past` back; redo does the reverse. A new change clears `future`. Since
  projects are never mutated, keeping one costs a reference, not a copy: the parts a change did
  not touch are shared.
- **Each snapshot keeps the selection** it was taken with, so undoing a move selects the hotspot
  that moved. The selection is checked against the project it comes back with, as after any
  change.
- **At most 100 steps:** the oldest is dropped. Memory stays small, since snapshots share parts.
- **One action, one step.** A change may carry a group key; changes with the same key less than
  1 s apart merge into one step, which keeps only the first "before". A drag uses one key for all
  its moves; a series of nudges, the selection; a field, the hotspot and the field. A change that
  leaves the project as it was records nothing.
- **An undo is a change like any other:** it is saved after the quiet time and reaches every
  open tablet.
- **The history is the tab's own.** It is not stored, so a reload starts afresh. A project saved
  by another editor, opened from the library, or reloaded after a stale save clears it, and the
  editor says so; undo then never overwrites someone else's work.
- **Not in the history:** the selection on its own, folded sections, the command log, the
  clipboard.

## Alternatives considered
- **Commands with inverse operations.** Each operation would need an exact inverse, written and
  tested for every one of them (paste, align, sequences, fader settings…), and kept in step as
  operations change. Snapshots need nothing per operation.
- **History on the server.** It would survive a reload and be shared, but undo would become a
  network round trip and a question of whose step to undo when two editors are open. The editor
  is where the integrator works; the history belongs there.
- **Keep the history when another editor saves.** Undo could then put back this tab's old
  project over the other editor's work, and the last save wins (ADR 0011). Clearing is the safe
  choice.
- **Every change a step.** Simplest, but undoing a drag would take dozens of presses and a typed
  name one per letter.

## Consequences
- Undo works for every change the editor makes, with no work per operation; new operations get
  it for free as long as they go through the store's `change`.
- Grouping needs a key from the few places that make continuous changes: the canvas drag, the
  arrow keys and text fields.
- Undo across a reload, or of another editor's change, is not possible by design.
