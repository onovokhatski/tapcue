# 0025. Motion: presets, not parameters

Status: Accepted · Date: 2026-11-25

## Context
A stand is mostly idle, and a tablet that never moves draws nobody to it. The player has a fade
between pages ([spec PG-4](../spec.md#53-pages)) and four press effects (HS-5); the roadmap's next
item was idle ("attract") animations, more press effects and transitions.

The user set the rule for this work on 2026-11-25, after dropping image-based pressed states for
adding too many settings: the editor must not fill up with controls. Motion comes as presets, one
choice per place, with defaults that already make the stand livelier.

## Decision
- **One page transition for the whole project** (Settings): Fade (default), Slide, Zoom or None.
  A stand reads as one piece; a transition per hotspot would be many settings for little gain.
- **Slide finds its own direction** from the page order in the editor: to a page further down the
  list the new page comes in from the right, to one further up from the left. A "Back" hotspot
  slides back without being told to. The station's idle return slides like any other change.
- **PG-5 holds for every transition:** the incoming page starts only when its background is
  ready, and the shown page stays underneath until the transition ends. None swaps the page as
  soon as it is ready.
- **Two more press effects, Pop and Glow,** as entries in the existing list. Pop grows the
  hotspot by a few percent on release and settles it back; Glow lights the hotspot's shape while
  it is pressed. The release delay before a page change covers their visible part (ADR 0014).
- **Invite taps when idle, one switch per station.** After 15 s without a touch on the station's
  start page, its hotspots that do something (go to a page or send a command) pulse softly one
  after another, in page order, in a loop. The first touch stops it at once; it starts again
  after the next 15 s. Tapcue chooses the hotspots: marking them one by one would be the kind of
  setting the user ruled out. Faders and hotspots that do nothing stay still, as do other pages.
- **Transforms and opacity only.** They are composited by the GPU on an iPad, so motion never
  delays a tap or drops frames, and the durations come from the design tokens.
- **An attract screen needs no feature:** a start page with a looping video and one large "Touch
  to start" hotspot, which the idle return brings back.

## Alternatives considered
- **A transition per hotspot,** or a direction to choose for Slide. Precise, but a setting on
  every button; the page order gives the right direction almost always.
- **Durations, delays and speeds to choose.** Every stand would differ for no reason, and the
  panel would grow by a dozen fields.
- **Marking the hotspots that invite.** The hotspots that do something are the ones to invite to;
  Tapcue can tell them apart.
- **A built-in attract video or screensaver.** Pages already do it, with the designer's artwork.

## Consequences
- The stand moves by default: a fade between pages and, once switched on, an invitation while
  idle.
- The project format gets a top-level `transition`, two press effects and a station's
  `inviteTaps` ([project format §2, §5, §8](../project-format.md)); older apps refuse projects
  that use them.
- Anything finer, such as a transition for one page, is out of reach by design.
