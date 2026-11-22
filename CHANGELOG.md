# Changelog

What changed in each release of Tapcue. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.4.0] - 2026-11-21

One Tapcue server keeps several stands and runs one of them: projects are created, opened and
deleted from the editor ([ADR 0021](https://github.com/onovokhatski/tapcue/blob/main/docs/adr/0021-project-library.md)).

### Added

- **Projects library:** projects live side by side in one folder, by default `Documents/Tapcue`
  in your home folder, one subfolder each. `--projects` or `TAPCUE_PROJECTS` puts it elsewhere.
- **Projects tab** in the editor: every project with its canvas size and last change, the open
  one first. A project that does not load shows why. The project name in the top bar leads there.
- **New project:** a name and a canvas size, from common stand screens (iPad, iPad Pro 12.9″,
  Full HD, 16:10) or typed in, give an empty project with one page and one station, "Main". It
  opens on every station at once.
- **Open a project:** after a confirmation, every station and editor switches to it within a
  second. What the editor still has waiting is saved into the previous project first. Tapcue
  opens the same project again after a restart.
- **Delete a project:** after a confirmation, its folder moves into the library's `.trash`
  folder, from which it can be brought back by hand. The open project cannot be deleted.
- **API:** `GET /api/projects`, `POST /api/projects`, `POST /api/projects/:id/open` and
  `DELETE /api/projects/:id`.

### Changed

- **Which project starts:** the one `--project` names, else the one last opened from the
  library, else the demo stand as before. The click-to-run app keeps its copy of the demo stand
  in the library.
- **Saving:** the editor names the revision its copy came from, so a save made before another
  project was opened is refused and the editor shows the open project instead. The change made
  in those last moments is dropped, not written into the other stand.
- **Fader values** start over from each fader's start when another project is opened.
- **Online demo:** it keeps its one project; creating, opening and deleting are turned off.

### Known limitations

- Emptying `.trash` and renaming a project's folder are left to the file system.
- Not yet checked on an iPad: faders (from 0.3.0), the stand setup (from 0.1.0) and the frosted
  backdrop over video (from 0.2.0)
  ([docs/ipad-check.md](https://github.com/onovokhatski/tapcue/blob/main/docs/ipad-check.md)).

## [0.3.0] - 2026-11-20

Besides buttons, a hotspot can be a fader that sends a value while it is dragged: a volume, a
layer's opacity, a light level ([ADR 0020](https://github.com/onovokhatski/tapcue/blob/main/docs/adr/0020-faders.md)).
Milestone v0.3.

### Added

- **Faders** (`kind: "fader"`, `fader`): a vertical or horizontal control with a range, a step
  and a start value. It keeps everything a hotspot has (shape, style, frost, image, text) and
  shows a level and a knob on the player. Dragging it, or touching its track, sets the value.
- **Value commands:** for OSC the value is an argument of its own, sent as a float or an integer,
  at a position you choose. For UDP text and an HTTP path or body, `{value}` is replaced by the
  value as text: `128`, or up to 3 decimals such as `0.75`.
- **Shared value:** the Tapcue server holds each fader's value. Every tablet on any station shows
  the same position, and a reloaded tablet shows it again. While a fader is dragged, about 25
  commands a second are sent, and the value where the finger stops is always sent. Offline, a
  tablet sends that last value once it is back.
- **Editor:** a Type section makes a hotspot a button or a fader, with fields for direction,
  range, step, start value and where the value goes; each field accepts only a value that fits
  the others. Send test sends a value of your choice.
- **Command log:** a drag is one row, for its final value, with the number of values it sent.
- **Demo:** the demo stand has a Volume fader on the Product A page, and the demo receiver shows
  a fader's value as a level on its screen's tile. HTTP commands of a fader carry an
  `X-Tapcue-Fader` header with the value, min and max.

### Changed

- **Project format:** `kind` and `fader` are optional, and an absent `kind` means a button.
  Projects from 0.2.0 open unchanged; `schemaVersion` stays 1.
- **Number fields** step by fractions where a field needs it, such as 0.01 for a fader's range.

### Known limitations

- A fader shows the last value Tapcue sent, not the media server's level: a change made on the
  media server itself is not seen (no feedback from media servers yet). After a server restart
  faders are back at their start values.
- Faders are not yet checked on an iPad
  ([docs/ipad-check.md](https://github.com/onovokhatski/tapcue/blob/main/docs/ipad-check.md)),
  nor are the stand setup (from 0.1.0) and the frosted backdrop over video (from 0.2.0).

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
