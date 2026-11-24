# 0022. Command sequences: several commands per tap, with delays

Status: Accepted · Date: 2026-11-22

## Context
A hotspot's action sends at most one command ([spec ACT-1](../spec.md#55-actions)). A stand often
needs one tap to drive several things in order: start a clip in Resolume, then fire a QLab cue a
moment later, or switch a light and the screen together. Today that takes a show file on the media
server that chains the steps, or several hotspots stacked on top of each other.

The commands are already sent by the Tapcue server, not by the tablet
([ADR 0005](0005-player-sends-hotspot-refs.md)): the player names the hotspot, the server looks
up what to send. A sequence fits that split.

## Decision
- **An action has a list of steps.** `action.command` becomes `action.commands`: up to 20 steps,
  each `{ "delayMs": …, "command": … }`. `delayMs` is optional, 0 when absent, a whole number of
  milliseconds from 0 to 60000, and is the pause **before** that step. Each step names its own
  target, so a sequence may mix media servers and protocols. An empty list sends nothing.
- **The format moves to `schemaVersion: 2`,** as the versioning rule says for a change that old
  readers would get wrong ([project format §12](../project-format.md#12-versioning)). A version 1
  project is upgraded where it is read, on load and on import: `command: X` becomes
  `commands: [{ command: X }]` and `command: null` becomes `commands: []`. The upgraded project
  is written by the next save. One function holds this upgrade; nothing else reads `command`.
- **The server runs the sequence.** It sends step 1 at once and each next step after its delay,
  on its own timers. The tablet changes page immediately, as before (ACT-3); a tablet that sleeps
  or goes to another page does not stop the sequence.
- **A new tap on the same hotspot starts it over.** That hotspot's pending steps are cancelled
  and step 1 runs again. This holds for taps from any station, because the media server they
  drive is shared. Sequences of other hotspots keep running.
- **A failed step does not stop the rest.** It is logged as an error and the next step runs on
  time, so one unreachable target does not stall a stand.
- **Pending steps are dropped** when another project is opened
  ([ADR 0021](0021-project-library.md)) and when the server stops. Each step reads its hotspot as
  it is when the step runs, so an edit made mid-sequence applies to the steps not yet sent; if the
  hotspot or the step is gone, the rest is dropped.
- **The log has one entry per step,** marked "step 2 of 3" with the delay it waited, and a note
  when steps were cancelled. "Send test" in the editor runs the whole sequence (ACT-4).
- **A fader keeps one command:** its `commands` has at most one step, with no delay. A sequence
  on every move of a finger would flood the targets and has no clear meaning.
- **The editor shows delays in seconds with tenths** (`2.5 s`); the file keeps milliseconds, like
  every other duration in the format.

## Alternatives considered
- **Keep `command` and add an optional `then` list.** No schema version change, but two ways to
  write the same action, and every reader would need both. The upgrade function is small and
  keeps the format to one way.
- **Delays on the tablet,** with the player sending each step. Simpler on the server, but a
  sequence would stop when the tablet sleeps, reloads or loses Wi-Fi, and two tablets could run
  the same sequence twice.
- **On a new tap: ignore it while a sequence runs, or run a second one in parallel.** Ignoring
  makes a button feel dead for up to minutes; running in parallel sends interleaved commands the
  integrator did not design. Starting over does what a visitor expects from pressing again.
- **Stop at the first failed step.** Safer for steps that depend on each other, but on a stand an
  unreachable light should not keep the video from starting. A "stop on error" option can come
  later if a stand needs it.

## Consequences
- One tap can drive a whole cue: several targets, in order, with timing, set up in the editor.
- Projects from 0.4.0 and earlier open and import unchanged in behaviour; once saved by 0.5.0
  they cannot be opened by an older Tapcue, which refuses a newer `schemaVersion` with a clear
  message.
- The server keeps per-hotspot timers; they are cancelled on a new tap, on opening another
  project and on stop.
- Sequences are as reliable as single commands: UDP still cannot confirm arrival (TGT-5).

## Amendment (2026-11-23, v0.6): named steps and steps that are off
- **A step may have a `name` and `enabled`**, both optional, so `schemaVersion` stays 2 (spec
  ACT-9). Tapcue 0.5 refuses such a project: its step schema allows no other fields.
- **A step that is off is skipped with its pause,** as if it were not in the list: not sent, not
  waited for, not logged, and not counted in "step 2 of 3" nor in `X-Tapcue-Sequence`. The
  integrator switches a step off to try a cue without it, and expects the rest to keep its rhythm
  without a gap. Keeping the pause was considered and rejected: a silent wait for a command that
  never comes reads as a fault on the stand.
- **Every step off** sends nothing, like a button without commands; "Send test" answers 409.
- **A fader's one command can be switched off:** a drag still moves the fader on every tablet,
  and sends nothing.
- **The log carries a step's name** in `sequence.name`, also for a single named command, so the
  log reads "Lights up" rather than "Step 2 of 3". The name is not sent to the media server: the
  `X-Tapcue-Sequence` header stays as it was and is sent only for a real sequence.
