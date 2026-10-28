Tapcue Design system v0.1 · light

Foundations

- [Colour](#colour)
- [Type](#type)
- [Spacing & radii](#spacing)
- [Elevation & focus](#elevation)
- [Contrast check](#contrast)

Components

- [Icons](#icons)
- [Button](#button)
- [Text field](#text-field)
- [Select](#select)
- [Number field](#number-field)
- [Colour field](#color-field)
- [Segmented control](#segmented)
- [Tab](#tab)
- [List item](#list-item)
- [Status badge](#status-badge)
- [Log row](#log-row)
- [Hotspot overlay](#hotspot)
- [Connection indicator](#connection)
- [Dialog](#dialog)
- [Banner](#banner)
- [QR card](#qr-card)

# Tapcue design system

Tokens and components for the editor, the player and the demo receiver. The chrome is warm grey so artwork reads honestly. Amber, the standby cue light, marks selection and the primary action. Status always pairs a colour with a shape or icon and a word.

Every value on this page is read live from tokens.css, so the specimen cannot drift from the source. Tokens map 1:1: color/text/secondary → --color-text-secondary → Tailwind text-secondary.

Foundations

## Colour

Primitives are the raw palette and are never used in components. Semantic tokens point at primitives; a dark mode later redefines only the semantic layer.

### Primitives

### Semantic tokens

Token · alias · resolved value

### Accent and warning never meet

Amber is a fill that carries dark text and means "act here" or "this is selected". Warning is a red-leaning orange, always shown as a tint with a triangle and a word. They differ in hue, in form and in label.

accent/default fill

URL will change warning tint + triangle

#fbbf24 vs #ea580c, hue 43° vs 21°

Foundations

## Type

Inter for the interface. JetBrains Mono for anything a machine reads: OSC addresses, IPs, ports, URLs, timestamps and hex values. Ligatures are off in mono so -> stays two characters.

| Style | Sample | Spec | Tailwind |
| --- | --- | --- | --- |
| Heading XL | Demo stand | Inter 600 24/32 −1.5% | text-heading-xl |
| Heading L | Replace the current project? | Inter 600 20/28 −1% | text-heading-l |
| Heading M | Product A | Inter 600 16/24 −0.5% | text-heading-m |
| Body M | Tapping this hotspot sends a command to Resolume. | Inter 400 14/20 | text-body-m |
| Body S | 4 hotspots · Image 2048 × 1536 | Inter 400 12/16 | text-body-s |
| Label M | Send test | Inter 500 14/20 | text-label-m |
| Label S | Corner radius | Inter 500 12/16 +0.5% | text-label-s |
| Overline | On tap | Inter 600 11/16 +8% caps | text-overline uppercase |
| Mono M | /composition/columns/2/connect | JetBrains Mono 400 13/20 | font-mono text-mono-m |
| Mono S | 14:32:07.418 · 192.168.1.20:7000 | JetBrains Mono 400 12/16 | font-mono text-mono-s |

Foundations

## Spacing and radii

A 4 px grid on the Tailwind scale (1 = 4 px). The 2 px half step is only for hairline offsets such as the segmented control's inner padding.

### Spacing

### Radii

Foundations

## Elevation and focus

Panels sit flat and are separated by borders. Shadow is kept for things that float above the work.

Elevation 1

Raised: thumbnails, QR card, dragged row at rest

--elevation-1

Elevation 2

Floating: select menu, toast, dragged row

--elevation-2

Elevation 3

Modal: dialogs over the scrim

--elevation-3

### Focus ring

2 px --color-border-focus (amber 700), 2 px offset. Text fields draw it on their own edge instead. Shown on every keyboard focus; never removed.

Foundations

## Contrast check, WCAG 2.2 AA

Every text and UI-boundary pair used by the components below, computed in the browser from the live token values. Text needs 4.5:1; icons, field borders, focus rings and selection indicators need 3:1. Disabled controls are exempt and listed for reference.

| Sample | Foreground | Background | Used for | Ratio | Result |
| --- | --- | --- | --- | --- | --- |

Component

## Icons

Use for actions that repeat in tight space, always next to a text label or with an aria-label. 16 px grid, 1.5 px stroke, round caps, colour from currentColor.

- plus
- trash
- copy
- external
- chevron-down
- grip
- close
- check
- alert
- wifi-off
- arrow-right +
- info +

Dashed tiles marked + are additions the components need: arrow-right for page navigation in the log, info for the Info banner.

Component

## Button

Use Primary for the one main action in a view, Secondary for everything else, Ghost inside toolbars and lists, and Danger only for the confirming action of a destructive dialog.

| Variant | Default | Hover | Pressed | Disabled | Focus |
| --- | --- | --- | --- | --- | --- |
| Primary |  |  |  |  |  |
| Secondary |  |  |  |  |  |
| Ghost |  |  |  |  |  |
| Danger |  |  |  |  |  |

Size M · 32 px

Size S · 28 px

Icon only · Ghost

Busy

Props: variant primary | secondary | ghost | danger · size m | s · leadingIcon · iconOnly (requires aria-label) · busy · disabled.

Component

## Text field

Use for names and free text. Use the mono option for anything a machine reads: OSC address, host, URL, path, raw UDP payload.

Default

Name

Shown in the log and on the canvas.

Focus

Name

Shown in the log and on the canvas.

Placeholder

Name

Shown in the log and on the canvas.

Error · mono

Host

Each part of an IP address must be 0–255.

Mono

OSC address

Starts with /

Disabled

Base URL

Not used with UDP.

Multiline · mono (UDP text, HTTP body)

Body

Props: label · value · placeholder · helper · error (replaces helper, sets aria-invalid) · mono · multiline · disabled.

Component

## Select

Use to pick one item from a list of four or more, or a list that grows (pages, targets). For two or three fixed options use the segmented control.

Default

Send command to

Open

Send command to

- None
- ResolumeOSC over UDP
- ProjectorUDP
- Demo receiverHTTP

Selected: check + tint. Hover: grey. Keyboard moves the grey highlight.

Disabled

Go to page

Add a second page to link to it.

Props: label · options\[\] {value, label, meta?} · value · placeholder · allowNone · open · disabled · helper.

Component

## Number field

Use for geometry and other short numbers in the properties panel. The axis letter sits inside the field so four fit in one row. Arrow keys step by 1, Shift + arrow by 10.

Default · X Y W H row

Position, px

X Y W H

Focus · Error · Disabled

X W H Rpx

Width must be at least 8 px.

Props: prefix (axis letter) · suffix · value · min · max · step · error · disabled.

Component

## Colour field

Use for hotspot fill and border and the canvas background. The swatch opens the system picker; the hex is typed. "None" is a real value, so invisible hotspots are explicit.

Set

Fill

None

Fill

None

Focus

Border

Error · Disabled

Use 6 hex digits, e.g. #1C1917.

#000000

Props: label · value (hex | null) · allowNone · error · disabled. Opacity is a separate number field.

Component

## Segmented control

Use to choose between two or three fixed options whose choice changes the form below it: shape, protocol, scale mode, HTTP method.

2 options

3 options

Focus on option

Disabled

Selected option is a raised white segment with primary text; unselected text is secondary. The difference is shape and weight of the plate, not colour alone. Props: options\[\] · value · label (aria) · disabled.

Component

## Tab

Use only for the editor's top navigation between Pages, Targets, Stations and Settings. Shown in the top-bar context.

Tapcue/ Demo stand

[Pages](#tab) [Targets](#tab) [Stations](#tab) [Settings](#tab)

Pages Active: primary text + 2 px accent-strong bar, aria-current="page" Targets Inactive Stations Hover Settings Focus

The bar uses amber 700, not amber 400, so the indicator reaches 3:1 on white. Props: label · href · active · count?.

Component

## List item

Use for the left-hand lists: pages (with thumbnail, reorderable), targets and stations (text only). The row itself selects; the grip reorders; actions appear on hover and selection.

Page row · Default, Hover, Selected, Focus

- Home4 hotspots · Start page
- About us1 hotspot · Video
- Product A3 hotspots · Image
- Product B3 hotspots · Image

Reorder · Dragging, Drop position, Rename

- Home4 hotspots · Start page
- 
- Product BOriginal position
- Product BDragging
- 

Text-only row · Targets, Stations

- ResolumeOSC over UDP · 192.168.1.20:7000
- ProjectorUDP · 192.168.1.40:4352
- Demo receiverHTTP · http://localhost:4000

Selected = amber tint + amber edge, plus aria-current. Drop position = 2 px amber 700 line with a ring at its start. Keyboard reorder: focus the grip, Alt + ↑/↓. Props: title · meta · thumbnail? · draggable · selected · editing · actions.

Component

## Status badge

Use for system state the integrator must trust at a glance: server link and autosave in the top bar, the result of each command in the log. Each status has its own shape and word.

- Connected

  Connected
- Disconnected

  Disconnected
- Saving

  Saving…
- Saved

  Saved
- Error

  Save error
- Sent

  Sent
- Test (tag)

  Test

In the top bar

Connected Saved Saved is quiet on purpose: it is the normal state. Errors are loud.

Props: status connected | disconnected | saving | saved | error | sent · label? (override, e.g. "Save error", "HTTP 503"). Top-bar badges use role="status" so changes are announced.

Component

## Log row

Use in the editor's command log and the demo receiver. One row per tap or test send, newest on top. The row says who tapped what, where it went and what happened.

| Time | Result | Source | Hotspot | Command | Variant |
| --- | --- | --- | --- | --- | --- |
| 14:32:07.418 | Sent | Main catalog | Product A card | Resolume /composition/columns/2/connect i 1 | Sent |
| 14:31:52.006 | Error | Test | Product A card | Demo receiver POST /demo/screen-1/product-a · Timed out after 2 s | Error |
| 14:31:40.771 | Page | Small screen | Back | Product B  Home · no command | Navigation |

A tap that both navigates and sends shows the command row only, with "→ Product A" appended in muted text. Error rows get a faint red tint and the reason in words. Props: time · result sent | error | navigation · source (station name or test) · hotspot · target · command · args · navigateTo? · error?.

Component · editor canvas only

## Hotspot overlay

Use on the editor canvas to find, select and resize hotspots. Never rendered in the player. Every line is two-tone, a dark under-stroke with a light stroke on top, so it holds on light, mid-tone and dark artwork alike.

|  | Light artwork | Mid-tone artwork | Dark artwork |
| --- | --- | --- | --- |

Idle: dashed white over a solid dark line, so hotspots with no fill can still be found. Hover: solid white line and a faint white wash. Selected: amber line, name chip, eight square handles, each with a dark border and light halo. Props: shape rect | ellipse · state idle | hover | selected · name · radius · x y w h (page px).

Component · player only

## Connection indicator

Use only in the player, only while the link to the server is down. Bottom-right corner, 12 px from the edges plus safe-area insets. It is the only Tapcue UI a visitor can ever see, so it stays small and translucent.

Reconnecting…

On light artwork

Reconnecting…

On dark artwork

Dark 72% plate with a 30% white ring: the text sits on its own plate (≥ 12:1 at worst), the ring separates it from dark artwork. Taps still work while it shows; commands are queued for 5 s, then dropped. Props: visible · corner (default bottom-right).

Component

## Dialog

Use only to confirm an action that is hard to undo: deleting a target or page, replacing the project. Never for information. The title asks the question; the body says what will happen to which things.

### Replace the current project?

“tapcue-demo-stand.zip” has 4 pages, 3 targets and 2 stations. The pages, hotspots, targets and stations of “Demo stand” will be replaced. Export first if you may need them.

Default

### Delete target “Resolume”?

3 hotspots send commands to it: Product A, Product B and Product C cards. Their commands will be cleared. Page links on those hotspots stay.

Danger · focus starts on Cancel

Width 440 px, radius xl, elevation 3, on --color-bg-scrim. Esc and the scrim cancel. Props: tone default | danger · title · body · confirmLabel · cancelLabel · onConfirm.

Component

## Banner

Use inside a panel to explain a condition that affects what the integrator is doing right now. Info for context, Warning for a consequence, Error for something that failed and needs action.

Demo mode

Changes stay in this browser tab and are lost when you close it. Saving, uploads and import are turned off.

Tablets using the old URL will stop working

Changing the id from main changes the station URL. Scan the new QR code on every tablet already set up.

Upload failed

about-loop.mov is 812 MB. The limit is 500 MB. Export a smaller H.264 file and try again.

Error is an addition: upload and import failures need it. Props: tone info | warning | error · title · children · action? · dismissible.

Component

## QR card

Use on the Stations tab so the integrator can point a tablet camera at the screen and open the station. The URL is also selectable text for typing or pasting.

Station URL

http://192.168.1.10:4000/play/main

[Open](#qr-card)

Default

Station URL

http://192.168.1.10:4000/play/main

[Open](#qr-card)

URL copied to the clipboard.

Copied · reverts after 2 s

Station URL

Fix the id to show a QR code

http://192.168.1.10:4000/play/—

Disabled · id invalid

The QR is always black on white inside its own plate, whatever the theme, so phone and tablet cameras read it. Props: url · copied · disabled.