# 0020. Faders: a hotspot that sends a value

Status: Accepted · Date: 2026-11-19

## Context
Until v0.2 every hotspot is a button: a tap sends one fixed command. A stand also needs controls
that set a level: the volume of a showreel, the opacity of a layer, the brightness of a light.
On a media server such a level is a number, usually a float from 0 to 1 sent over OSC.

A fader is the first control in Tapcue with a **value** and therefore with **state**. It raises
questions a button never did: who knows the current value, what two tablets show, how many
commands a drag may send, and what happens when the network drops mid-drag. Tapcue still does not
know what a media server is playing ([spec §3](../spec.md#3-goals-and-non-goals)), and feedback
from media servers stays out of scope for now (roadmap, after MVP).

## Decision
- **A fader is a kind of hotspot.** A hotspot gets `kind`: `"button"` or `"fader"`. An absent
  `kind` means a button, so every existing project stays valid and `schemaVersion` stays 1. A
  fader keeps everything else a hotspot has (box, shape, style, frost, image, text, stacking) and
  adds:
  - `orientation`: `"vertical"` (bottom = minimum) or `"horizontal"` (left = minimum);
  - `min`, `max`, `step` and a `start` value inside the range;
  - a command that carries the value. For OSC it is one argument marked as the value, sent as
    `f` or `i`; UDP text and an HTTP path or body use a `{value}` placeholder (a later issue).

  A fader has no page change (`goTo`) and no press effect: dragging is not a tap.
- **The player sends the value, never the command.** As with taps
  ([ADR 0005](0005-player-sends-hotspot-refs.md)) the player says
  `{ type: "value", pageId, hotspotId, value }`, and the server checks the value against the
  fader's range and builds the command itself. A player cannot make the server send anything the
  project does not describe.
- **The server holds the value.** It remembers each fader's last value, broadcasts every change to
  all connected players and sends the current values to a player when it says `hello`. Two
  tablets on the same page show the same position. The values live in memory: after a server
  restart every fader is back at its `start` value. The project file is not changed by dragging.
- **A limited rate, the last value always.** While a fader is dragged the server sends at most
  about 25 commands a second for it, enough for a smooth fade on a media server. The value the
  finger stops at is always sent, also when it falls between two sends.
- **Offline, only the last value counts.** A player that loses the connection keeps the knob where
  the finger leaves it and sends that one value when it is back, instead of the queued taps' 5 s
  rule (spec PLY-3): a level set a minute ago is still the level the visitor wants.
- **Idle return keeps the value.** Returning to the start page (spec ST-4) changes the page, not
  the media server's level, so a fader keeps its value.
- **No feedback from media servers.** The fader shows the last value Tapcue sent. If the level is
  changed on the media server itself, the fader does not know. This is documented as a
  limitation. The stored value is the one place a feedback source would update later, so feedback
  can be added without changing players.
- **The command log** keeps one row per drag, updated with the final value and the number of
  values sent, instead of a row for each of them.

## Alternatives considered
- **A separate element type next to hotspots.** Cleaner in theory, but every editor feature
  (placement, style, image, text, stacking, safe area) would be built twice. A fader is a
  hotspot that behaves differently on touch.
- **Each tablet keeps its own value.** Simpler, but two tablets would show different positions for
  one media-server level, and a reloaded tablet would forget it.
- **Sending every pointer move.** A drag produces about 60 events a second; media servers, the
  network and the command log gain nothing from more than about 25.
- **Feedback from media servers now.** It makes the position honest, but needs a listener per
  protocol, mapping incoming addresses to faders, echo suppression and an "unknown" state. It is
  its own milestone, decided against for v0.3.

## Consequences
- Volume, opacity and light levels can be controlled from a stand without code.
- The server gains state that is not in the project: fader values in memory. A restart resets
  them, and the media server is not told about it; a stand can set its levels again from a
  tablet.
- The protocol grows by one client message and one server message, both validated by the shared
  schema like the rest.
- The fader's position can drift from the media server when someone changes the level there.
  The stand setup guide says so.
- Milestone v0.3 builds it in this order: format, server, player, editor, UDP and HTTP values,
  demo receiver and log.
