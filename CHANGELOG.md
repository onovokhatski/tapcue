# Changelog

What changed in each release of Tapcue. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.7.0] - 2026-11-24

The editor gets out of the way on a busy stand. Several hotspots are selected, copied to another
page, aligned and styled together; the page list and command cards fold away; commands have names
and an on/off switch; and the hotspot panel folds into one line per section. Milestones v0.6
(Editor tidy-up) and v0.7 (Properties panel), released together.

### Added

- **Select several hotspots:** Shift-, Cmd- or Ctrl-click, a rectangle dragged on the empty page,
  or Cmd/Ctrl + A; Escape clears. Drag one of them to move them all, nudge them with the arrow
  keys, duplicate them, or delete them after one confirmation. The group stops as a whole at the
  canvas edge.
- **Copy and paste hotspots** between pages of the project: Cmd/Ctrl + C and V, or Copy and Paste
  in the editor. Copies land at the same positions (24 px off on their own page) with new names,
  and keep everything else.
- **Align, distribute, same size:** align left, centre, right, top, middle or bottom (several to
  their common box, one to the canvas); spread three or more with equal gaps; give several the
  width, height or size of the first.
- **Edit several at once:** the shape, style and text style that selected hotspots share; a value
  they do not share shows as "Mixed".
- **Named commands that can be switched off:** a step of a sequence can have a name, shown in the
  editor and the command log, and an on/off switch. A step that is off is skipped with its pause
  and not counted; a fader's command can be switched off too.
- **Foldable command cards:** each folds into one line with its name, target, command and pause;
  Fold all and Unfold all.
- **Foldable panel sections:** every section of the hotspot panel folds and says its state in one
  line ("144, 500 · 560 × 720", "Go to Product A · 2 commands over 1.5 s"). The folds are kept in
  the browser, the same for every hotspot.
- **Go to page as a command card:** the page link is the first card among the commands, added
  next to Add command.
- **Collapsible page list:** the page list folds into a rail of thumbnails at any window width.

### Changed

- **Unique hotspot names on a page:** a new hotspot is named "Button N", a copy gets a free name
  ("Play demo 2"), and a rename to a name another hotspot on the page has is refused with a hint.
  Duplicates in older projects stay until edited.
- **The hotspot panel's order** goes from how a hotspot looks to what it does: Name, Type,
  Position and size (with the align tools), Style (with the shape), Text, On tap, Stacking.
- **Position and size fields** show four-digit values in full.
- **Project format:** a step may have `name` and `enabled`, both optional, so the schema version
  stays 2. Tapcue 0.5.0 refuses a project that uses them.

### Known limitations

- No undo yet: it comes next.
- The Windows app still opens a console window; a fix is in review (#230).
- Not yet checked on an iPad: sequences (from 0.5.0), faders (from 0.3.0), the stand setup (from
  0.1.0) and the frosted backdrop over video (from 0.2.0)
  ([docs/ipad-check.md](https://github.com/onovokhatski/tapcue/blob/main/docs/ipad-check.md)).

## [0.5.0] - 2026-11-23

One tap sends several commands in order, each after its own pause, to one media server or
several: start a clip in Resolume, then a QLab cue 2.5 seconds later
([ADR 0022](https://github.com/onovokhatski/tapcue/blob/main/docs/adr/0022-command-sequences.md)).
Milestone v0.5.

### Added

- **Command sequences:** a button's commands are a list of up to 20 steps, each with its own
  target and a pause before it of 0 to 60 seconds.
- **The server keeps the time:** the first step is sent at once, each next one after its pause,
  so a tablet that sleeps or goes to another page does not stop a sequence. A pause counts from
  when the step before was sent, so a slow target does not push the rest back.
- **Start over:** tapping the same button again, from any station, cancels the steps not yet
  sent and starts the sequence from the top. Other buttons' sequences keep running.
- **Editor:** On tap lists the commands. Each has a pause in seconds with tenths, a target and
  its fields; Add command reuses the last target; drag a command by its handle, or press
  Alt + ↑ / ↓ on it, to reorder. A summary says how many commands over how long. Send test runs
  the whole sequence and shows each step's result as it arrives.
- **Command log:** the steps of one tap are one row (Sent, Error, Cancelled or Running), opened
  to show each step with its place and pause.
- **`X-Tapcue-Sequence` header** on every HTTP command of a sequence: the tap's run, the step
  and how many steps (`17 2 3`).
- **Demo:** Play demo on the demo stand's Product A page sends a second command 1.5 s later,
  and the demo receiver shows a step's place and the time since the step before.

### Changed

- **Project format, schema version 2:** `action.command` became `action.commands`, a list of
  steps. Projects from 0.4.0 and older open and import as before and are written as version 2
  on the next save; Tapcue 0.4.0 and older then refuse them with a message about the version.
- **A failed step does not stop the rest:** it is logged as an error, and the next step is sent
  on time. Steps not yet sent are cancelled when another project is opened, and dropped when the
  server stops.
- **A fader** still sends one command, at once, with its value.

### Known limitations

- There is no "stop on error" option yet: every step of a sequence is sent.
- Not yet checked on an iPad: sequences, faders (from 0.3.0), the stand setup (from 0.1.0) and
  the frosted backdrop over video (from 0.2.0)
  ([docs/ipad-check.md](https://github.com/onovokhatski/tapcue/blob/main/docs/ipad-check.md)).

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
