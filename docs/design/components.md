# Tapcue — Component inventory

Handoff from design v1.0 (Claude Design). Each component lists its variants, states and props;
the last column is the reference function in the prototype (`prototype/src/components.js`).
Tokens: [tokens.css](../../packages/web/src/styles/tokens.css). Rendered frames: `prototype/dist/*.html`.

## Components

| Component | Variants | States | Props | Prototype |
|---|---|---|---|---|
| Icon | plus, trash, copy, external, chevron-down, grip, close, check, alert, wifi-off, arrow-right, info, image, video, upload, crop, download, panel-left | — | name, className | icon() |
| Button | Primary, Secondary, Ghost, Danger · size M 32 / S 28 · icon-only · toggle | Default, Hover, Pressed, Disabled, Focus, Busy, Toggle on | variant, size, icon, label, ariaLabel, disabled, pressed, busy | button() |
| Text field | Single line, multiline · mono · size M / S · prefix | Default, Focus, Error, Disabled, Read-only | id, label, value, placeholder, helper, error, mono, multiline, rows, prefix, size, disabled, readonly | textField() |
| Select | Size M / S · with meta | Default, Hover, Open, Disabled | id, label, value, meta, options, placeholder, size, helper, disabled | select() |
| Number field | Prefix (axis), suffix (unit) | Default, Focus, Error, Disabled | prefix, suffix, value, min, max, step, error, disabled | numberField() |
| Colour field | Set, None | Default, Focus, Error, Disabled | value (hex \| null), allowNone, ariaLabel, error, disabled | colorField() |
| Segmented control | 2–3 options | Selected, Unselected, Hover, Focus, Disabled | label, options, value, disabled | segmented() |
| Tab / Top bar | Pages, Targets, Stations, Settings | Active, Inactive, Hover, Focus | tab, conn, save, demo | topBar() |
| Shell | With list, without list, with banner, with modal | — | tab, body, collapsed, save, conn, demo, logRows, modal, banner | shell() |
| Shell banner | Info, Warning, Error | — | tone, title, body, action | shellBanner() |
| List item · page | Thumbnail, grip, delete | Default, Hover, Selected, Focus, Dragging, Drop position, Renaming | page, selected, hover | pageListItem() |
| List item · text | Title + meta | Default, Hover, Selected, Warning | title, meta, selected, warn | textRow() |
| List panel | Targets, Stations | Populated, Empty | title, items, addLabel, empty | listPanel() |
| Compact row | Optional lead, meta, trailing | Default, Hover, Focus | lead, title, meta, trailing | compactRow() |
| Status badge | Connected, Disconnected, Saving, Saved, Error, Sent, Unsaved, Waiting, Demo | — | status, label | badge() |
| Test tag | — | — | — | testTag() |
| Log row | Table · compact | Sent, Error, Navigation, Fresh | time, result, source, hotspot, target, command, args, navigateTo, error | logRow(), logRowCompact() |
| Command log | Expanded 176 px, collapsed 36 px | Populated, Empty | collapsed, rows | logPanel() |
| Hotspot overlay | Rectangle, Ellipse | Idle, Hover, Selected, Focus × Cropped warning | shape, state, name, radius, x, y, w, h, warn, chipBelow | hotspotOverlay() |
| Safe-area overlay | 16:10, 16:9 reference | — | reference, scale | .crop-zone, .safe-line, .canvas-chip |
| Empty canvas | — | — | — | .canvas-empty |
| Toolbar meta | — | Read-only | text, label | toolbarMeta() |
| Panel section · Form row | — | — | title, action, body / label, control | panelSection(), formRow() |
| Form card | — | — | title, action, body | formCard() |
| Empty state | — | — | icon, title, body, action | emptyState() |
| Upload dropzone | — | Default, Drag over, Disabled (demo) | active, disabled | dropzone() |
| File row | Image, Video | Ready, Uploading | type, name, meta, actions, progress | fileRow() |
| Progress bar | — | 0–100 | value, label | progress() |
| Banner | Info, Warning, Error | Dismissible | tone, title, body, action, dismissible | banner() |
| Dialog | Default, Danger | Initial focus on Cancel for Danger | tone, title, body, confirmLabel, cancelLabel, confirmIcon | dialog() |
| QR card | — | Default, Copied, Disabled | url, qr, copied, disabled | qrCard() |
| Scale diagram | Fit, Fill × 16:10, 16:9 | — | mode, ref, width | scaleDiagram() |
| Screen tile | — | Playing, Just changed | name, content, since, source, fresh | screenTile() |
| Connection indicator | Reconnecting, Loading | Visible only while needed | kind | .tc-indicator |
| Skeleton | — | Pulsing | className | skeleton() |

## Components per screen

| Screen | Components |
|---|---|
| Pages | Shell, Top bar, Status badge, Page list item, Button (primary, toggle, ghost, icon-only), Select, Toolbar meta, Hotspot overlay, Safe-area overlay, Empty canvas, Panel section, Text field, Number field, Colour field, Segmented control, Banner, Dropzone, File row, Progress bar, Compact row, Command log, Log row, Test tag, Shell banner, Skeleton |
| Targets | Shell, Top bar, List panel, List item · text, Form card, Text field, Segmented control, Compact row, Log row · compact, Empty state, Dialog (danger), Command log |
| Stations | Shell, Top bar, List panel, List item · text, Form card, Text field (prefix), Select, Segmented control, Number field, Banner (warning), QR card, Empty state, Command log |
| Settings | Shell, Top bar, Form card, Number field, Colour field, Segmented control, Scale diagram, Banner (info, error), Button, Dialog (default), Status badge (demo), Command log (collapsed) |
| Player | Artwork only · Connection indicator (reconnecting, loading) · "Station not found": Compact row, Icon. Handoff annotations are not shipped. |
| Demo receiver | Status badge (waiting, connected), Button, Text field (read-only), Screen tile, Log table rows, Empty-state card |

## State coverage

| Screen | Empty | Loading | Saving | Saved | Error | Disconnected | Disabled | Demo mode |
|---|---|---|---|---|---|---|---|---|
| Pages | F2 no background | E1 (added) | F2 | F1, F3a…F5 | F3b upload · E3 save (added) | E2 (added) | Ellipse radius, border width, Send test offline | E4 (added) |
| Targets | T2 | Shell, as E1 | Autosave, as S3 | T1 | T3 invalid | Shell, as E2 | n/a · no disabled controls | Shell badge, as G4 |
| Stations | S2 | Shell, as E1 | S3 | S1 | QR card · invalid id | Shell, as E2 | QR card disabled | Shell badge, as G4 |
| Settings | n/a · always has a canvas | Shell, as E1 | Autosave | G1 | G3 import | Shell, as E2 | G4 Import | G4 |
| Player | n/a · a station always has a start page | P0 (added) | n/a · read-only | n/a · read-only | P6 station not found | P5 | n/a · no controls | n/a · editor only |
| Demo receiver | R1 | n/a · static page | n/a · read-only | n/a · read-only | Request status column | n/a · local page | n/a · no controls | n/a · not part of the editor |

## One-off audit (resolved)

| Found | Where | Resolution |
|---|---|---|
| Zoom select in the canvas toolbar | Pages | Replaced by Toolbar meta, a read-only "Fit · 39%" label (decision 3). |
| Empty states built inline | Targets, Stations | New component Empty state (icon, title, body, one action). |
| Main-column form panels | Targets, Stations, Settings | New component Form card (title, header action, body). |
| Static dialog markup from the specimen | Targets, Settings | Dialog now has a function with default and danger tones. |
| QR card copies per state | Stations | QR card function with copied and disabled states. |
| "Used by" rows and page-hotspot rows, each hand-built | Targets, Pages | New component Compact row; also used on "Station not found". |
| "Recent commands" list | Targets | New variant Log row · compact. |
| URL box drawn as a styled span | Demo receiver | Replaced by Text field with the new read-only state. |
| "Waiting for the first command" pill | Demo receiver | Added Status badge states Waiting and Unsaved. |
| Screen tiles | Demo receiver | New component Screen tile with a "Just changed" state. |
| Fit / Fill diagram | Settings | New component Scale diagram, computed from the canvas and reference screen. |
| Connection pill with a literal white ring | Player | Now the Connection indicator class, token colours only; adds a Loading variant. |
| Literal rgb() values in hotspot chips and handles | Canvas overlay | Replaced with color-mix() of overlay tokens. |
| Press-effect and fade timings written as text | Player | Now motion tokens (--duration-press-in, --duration-ripple, --duration-page-fade …). |
| List rows as non-focusable divs | Pages, Targets, Stations | Rows are now buttons, so they are keyboard-reachable. |
| Annotation markers and legend | Player P2 | Kept as a handoff-only annotation kit. Never shipped in the product. |
| Sample artwork colours and fonts | Canvas, Player | Kept. Artwork is content from the designer, not UI, so it uses no tokens. |
