# 0019. Hotspot content: frosted backdrop, image and text

Status: Accepted · Date: 2026-11-16

## Context
Until v0.1, Tapcue adds interactivity and no visuals of its own
([spec §3](../spec.md#3-goals-and-non-goals)). Every label and picture of a button is part of the
page artwork, and a hotspot is at most a fill, a border and a press effect over it.

The first real stand after the release is a studio tour with three pages of 10–15 buttons each.
The guide's buttons change often: a new video, a renamed scene, a button that moves to another
page. Each change means re-exporting a page from the design tool and uploading it again. Many
buttons share one background and differ only in their label and picture. Designers also want
glass-like buttons over a photo or video background, and with the artwork alone that only works
when nothing behind the button moves.

## Decision
A hotspot may carry three kinds of content of its own, drawn by the player on top of the
artwork:

- **Frosted backdrop** (`style.backdropBlur`): what lies under the hotspot is blurred, within its
  shape. A semi-transparent fill over it gives the glass look.
- **Image** (`style.image`): an uploaded asset that covers the hotspot's whole box, keeping its
  proportions (cropped like CSS `cover`).
- **Text** (`text`): a label with its size, weight, colour, alignment and padding, in one font,
  the system sans-serif.

Rules for all three:

- **Optional fields.** Existing projects stay valid as they are, and `schemaVersion` stays 1. An
  absent field means none: no blur, no image, no text.
- **One layer order** inside a hotspot, bottom to top: backdrop blur, fill, image, text, border.
  Everything is clipped to the shape (rectangle with its corner radius, or ellipse). The opacity
  and the press effect act on the hotspot as a whole.
- **Canvas pixels.** Sizes (blur radius, text size, padding) are in canvas pixels, like the box
  and the border, so the hotspot scales with the page.
- **The editor shows them live on its canvas,** exactly as the player does.

The line stays where spec §3 draws it: Tapcue is **not a graphic editor**. A hotspot gets a few
properties, not layers, effects or free-form text. The page artwork remains the base of the
design.

## Alternatives considered
- **Keep the artwork as the only visual.** It is the simplest, and it stays possible: a hotspot
  without content is unchanged. But it leaves the problem: every label change is a round trip
  through the design tool.
- **A layer editor** (several texts and images per hotspot, free positions, shadows). It is far
  more to build, test and explain, and it competes with the designer's own tools, which
  [spec §3](../spec.md#3-goals-and-non-goals) rules out.
- **Custom fonts now.** Fonts must be uploaded, licensed for the stand and loaded before a page
  shows without a jump. The system font covers labels for v0.2; custom fonts can follow as their
  own decision.

## Consequences
- Labels and pictures of buttons can be changed in the editor in seconds, without the design
  tool.
- Each hotspot costs the player more to draw. Backdrop blur is the expensive part, above all over
  a video background on an iPad. It is checked on the demo stand's video page, where page changes
  and the video must stay smooth, before the blur is released.
- An image on a hotspot is an asset like a page background: it is uploaded, validated, preloaded
  with its page, and exported and imported with the project.
- Text drawn by the browser depends on the device's system font. On iPads it is San Francisco;
  on other tablets the label may look slightly different from the editor on a Mac.
- The project format, the player and the editor each grow by three optional parts, one issue per
  part (milestone v0.2).
