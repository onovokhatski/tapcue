# Changelog

What changed in each release of Tapcue. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

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

[0.1.0]: https://github.com/onovokhatski/tapcue/releases/tag/v0.1.0
