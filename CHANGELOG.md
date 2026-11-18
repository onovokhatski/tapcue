# Changelog

What changed in each release of Tapcue. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-11-18

Hotspots carry their own content on top of the artwork, so button labels and pictures change in
the editor instead of the design tool ([ADR 0019](https://github.com/onovokhatski/tapcue/blob/main/docs/adr/0019-hotspot-content.md)).
Milestone v0.2.

### Added

- **Frosted backdrop** (`style.backdropBlur`): a hotspot blurs what lies under it, within its
  shape. The editor's Style section has a Frost field.
- **Fill opacity** (`style.fillOpacity`): the fill fades on its own, so a glass button keeps
  crisp text and images on it. The hotspot's Opacity still fades it as a whole.
- **Image on a hotspot** (`style.image`): an uploaded JPEG, PNG or WebP covers the hotspot's
  box, cropped, within its shape. The player shows a page once its hotspot images are loaded too.
- **Text on a hotspot** (`text`): a label with its size, weight, colour, horizontal and vertical
  alignment and padding, in the system font. The editor has a Text section.
- **Number fields like in design tools:** drag a field's label (X, Y, W, H, R) or unit (%, px, s)
  to change the value, 10 at a time with Shift; arrow keys step it too.

### Changed

- **Project format:** new fields are optional, and an absent one means none. Projects from 0.1.0
  open unchanged; `schemaVersion` stays 1.
- **One focus ring** on a focused number field instead of two.
- **CI:** the check job may take up to 20 minutes, since a browser install can be slow.

### Known limitations

- The frosted backdrop over a video background is not yet checked on an iPad for smoothness.
- The iPad check of the stand setup (from 0.1.0) is still to be recorded in
  [docs/ipad-check.md](https://github.com/onovokhatski/tapcue/blob/main/docs/ipad-check.md).

## [0.1.0] - 2026-11-06

The first release: everything planned for the MVP in the
[roadmap](https://github.com/onovokhatski/tapcue/blob/main/docs/roadmap.md), milestones M0–M5.

### Added

- **Player** (M1, M2): shows a station full screen on a tablet's browser. It has page
  backgrounds (image or looping video, fit or fill) and hotspots with press-in, highlight and
  ripple effects. Page changes fade, and the next pages are loaded in advance. After an idle
  timeout the player returns to the start page.
- **Commands** (M2): a tap sends OSC over UDP, raw UDP or HTTP to the media server through the
  Tapcue server. The player shows its connection state and comes back after a network drop
  without a reload; taps made while offline are kept for 5 seconds.
- **Editor** (M3, M4): a browser editor for:
  - pages and artwork uploads;
  - hotspots: add, move, resize, duplicate, style, effect, and an action with Send test;
  - targets and stations, with their URLs and QR codes;
  - canvas settings, a command log, and autosave.

  Open players follow every change within a second.
- **Project transfer** (M4): export and import a whole project, artwork included, as one `.zip`.
- **One-command start** (M5): `npm start` builds the web app and serves the editor, players and
  demo receiver on one port.
- **Click-to-run app** (M5): `Tapcue.app` for macOS and `Tapcue.exe` for Windows, with no
  Node.js or terminal needed. The editor's Settings tab has a Quit Tapcue button.
- **Demo mode and the online demo** (M5): a mode in which no project is saved and no command
  leaves the server. The public demo runs in this mode at
  <https://tapcue-demo-production.up.railway.app>.
- **On a stand** (M5):
  - the player keeps the screen awake;
  - clear loading, reconnecting and upload states;
  - a [stand setup guide](https://github.com/onovokhatski/tapcue/blob/main/docs/stand-setup.md) covering iPad
    Auto-Lock, Guided Access and the network.
- **Quality** (M0, M5):
  - a project format checked by a schema;
  - unit tests, plus end-to-end tests in Chromium, WebKit and Firefox;
  - a 10-hour run of the built app with every command delivered
    ([results](https://github.com/onovokhatski/tapcue/blob/main/docs/ipad-check.md#long-run)).

### Known limitations

- The apps are not code-signed: macOS and Windows ask for confirmation on the first start (see
  the [README](https://github.com/onovokhatski/tapcue/blob/main/README.md#the-click-to-run-app)).
- The iPad check of the stand setup (Guided Access, 10 hours on the iPad itself) is still to be
  recorded in [docs/ipad-check.md](https://github.com/onovokhatski/tapcue/blob/main/docs/ipad-check.md).

[0.2.0]: https://github.com/onovokhatski/tapcue/releases/tag/v0.2.0
[0.1.0]: https://github.com/onovokhatski/tapcue/releases/tag/v0.1.0
