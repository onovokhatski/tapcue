# Tapcue — Project Format

Status: **draft** · Last updated: 2026-11-22 · Schema version: **2**

A Tapcue project describes one stand. It is the contract between the editor, the player and
the server: the Zod schema in `packages/shared` implements exactly what this document
describes. Terms are defined in [spec.md §4](spec.md#4-concepts).

## 1. Layout on disk

```
my-stand/
  project.json
  assets/
    home.jpg
    product-a.jpg
    waves.mp4
```

- `project.json` — the whole description, UTF-8 JSON.
- `assets/` — every image and video referenced by the project. Nothing outside this folder is referenced.
- For transfer, the folder is packed into a `.zip` with the same layout at its root.

Projects live side by side in a **library** folder ([ADR 0021](adr/0021-project-library.md)),
by default `Documents/Tapcue`:

```
Tapcue/
  tapcue.json        { "active": "weplay-2026" }: opened again after a restart
  demo-stand/
  weplay-2026/       project.json + assets/, as above
  .trash/
    hall-b-2026-11-21T10-15-00-000Z/
```

- Each subfolder with a `project.json` is a project; its folder name is its id. Hidden folders
  (`.trash`, an import in progress) are not projects.
- A new project's folder is named after it: lowercase letters, digits and `-`, made unique with
  a number (`weplay-2026-2`).
- A deleted project is moved into `.trash/` with the time it was deleted; Tapcue never empties it.

## 2. Top level

```json
{
  "schemaVersion": 2,
  "name": "Demo stand",
  "canvas": { ... },
  "pages": [ ... ],
  "targets": [ ... ],
  "stations": [ ... ]
}
```

| Field | Type | Rules |
|---|---|---|
| `schemaVersion` | integer | Always `2` for this version. A version `1` project is upgraded when it is read ([§12](#12-versioning)); a version Tapcue does not know is refused. |
| `name` | string | 1–100 characters. Shown in the editor. |
| `canvas` | [Canvas](#3-canvas) | |
| `pages` | [Page](#4-page)[] | At least one. Array order is the order in the editor. |
| `targets` | [Target](#6-target)[] | May be empty. |
| `stations` | [Station](#8-station)[] | May be empty (nothing can be played until one exists). |

## 3. Canvas

```json
{ "width": 2048, "height": 1536, "scaleMode": "fit", "backgroundColor": "#000000" }
```

| Field | Type | Rules |
|---|---|---|
| `width`, `height` | integer | 1–8192, canvas pixels. |
| `scaleMode` | `"fit"` \| `"fill"` | See [spec §4](spec.md#4-concepts). |
| `backgroundColor` | [Color](#91-color) | Fills the bars in `fit` mode and pages without a background. |

## 4. Page

```json
{
  "id": "p_h8x2kq",
  "name": "Home",
  "background": { "type": "video", "asset": "assets/waves.mp4" },
  "hotspots": [ ... ]
}
```

| Field | Type | Rules |
|---|---|---|
| `id` | [Id](#92-ids) | Unique among pages. |
| `name` | string | 1–100 characters. |
| `background` | Background \| `null` | `null` shows `canvas.backgroundColor`. |
| `hotspots` | [Hotspot](#5-hotspot)[] | Array order is stacking order: later hotspots are on top. |

**Background**

| Field | Type | Rules |
|---|---|---|
| `type` | `"image"` \| `"video"` | Video always plays muted and looped. |
| `asset` | [Asset path](#93-asset-paths) | |

## 5. Hotspot

```json
{
  "id": "h_3mq9za",
  "name": "Product A",
  "x": 120, "y": 400, "width": 500, "height": 300,
  "shape": { "type": "rect", "cornerRadius": 24 },
  "style": { "fill": null, "border": null, "opacity": 1 },
  "pressEffect": "ripple",
  "action": {
    "goTo": "p_7tn4vb",
    "commands": [
      { "command": { "type": "osc-udp", "targetId": "t_r2k8sd",
                     "address": "/composition/columns/2/connect", "args": [] } }
    ]
  }
}
```

| Field | Type | Rules |
|---|---|---|
| `id` | [Id](#92-ids) | Unique within the project. |
| `name` | string | 0–100 characters. Optional label for the editor and the command log. |
| `x`, `y` | number | Top-left corner in canvas pixels. |
| `width`, `height` | number | ≥ 1. The hotspot lies fully inside the canvas: `x ≥ 0`, `y ≥ 0`, `x + width ≤ canvas.width`, `y + height ≤ canvas.height`. |
| `shape` | Shape | See below. |
| `style` | Style | See below. |
| `text` | Text, optional | A label drawn on the hotspot. See below. Absent = no text. |
| `kind` | `"button"` \| `"fader"`, optional | Absent = `"button"`. A fader sends a value while it is dragged ([ADR 0020](adr/0020-faders.md)). |
| `fader` | Fader, optional | Required for a fader, not allowed otherwise. See below. |
| `pressEffect` | `"none"` \| `"highlight"` \| `"press"` \| `"ripple"` | Animation on tap. |
| `action` | [Action](#7-action) | |

**Shape** — one of:

| `type` | Extra fields |
|---|---|
| `"rect"` | `cornerRadius`: number ≥ 0, canvas pixels |
| `"ellipse"` | — (the ellipse fills the hotspot's box) |

**Style**

| Field | Type | Rules |
|---|---|---|
| `fill` | [Color](#91-color) \| `null` | `null` = transparent. |
| `border` | `{ "color": Color, "width": number }` \| `null` | Width 1–100 canvas pixels. `null` = no border. |
| `opacity` | number | 0–1, applies to the whole hotspot. |
| `fillOpacity` | number, optional | 0–1, applies to the fill only, so a translucent fill can carry a crisp image and text. Absent = 1. |
| `backdropBlur` | number, optional | 1–100 canvas pixels. Blurs what lies under the hotspot, within its shape, below the fill: a semi-transparent fill over it looks like frosted glass ([ADR 0019](adr/0019-hotspot-content.md)). Absent = no blur. |
| `image` | [asset path](#93-asset-paths), optional | A JPEG, PNG or WebP that covers the hotspot's whole box, keeping its proportions (cropped at the edges), within its shape, above the fill and below the border ([ADR 0019](adr/0019-hotspot-content.md)). The file must exist. Absent = no image. |

**Text** ([ADR 0019](adr/0019-hotspot-content.md)) — drawn above the image and below the border, clipped to the shape, in the device's system sans-serif font.

| Field | Type | Rules |
|---|---|---|
| `content` | string | 1–500 characters. Line breaks (`\n`) are kept. |
| `size` | number | 8–400 canvas pixels. |
| `weight` | `"regular"` \| `"medium"` \| `"bold"` | |
| `color` | [Color](#91-color) | |
| `align` | `"left"` \| `"center"` \| `"right"` | How the lines line up. |
| `verticalAlign` | `"top"` \| `"middle"` \| `"bottom"` | Where the text sits in the hotspot. |
| `padding` | number | 0–500 canvas pixels between the hotspot's edge and the text. |

**Fader** ([ADR 0020](adr/0020-faders.md)) — a hotspot with `kind: "fader"` sets a value by
dragging along it and sends its command with that value. It has at most one command, sent at
once: no sequence and no delay ([ADR 0022](adr/0022-command-sequences.md)).

```json
"kind": "fader",
"fader": {
  "orientation": "vertical", "min": 0, "max": 1, "step": 0.01, "start": 0.8,
  "value": { "at": 0, "as": "f" }
},
"pressEffect": "none",
"action": { "goTo": null, "commands": [
  { "command": { "type": "osc-udp", "targetId": "t_r2k8sd",
                 "address": "/composition/layers/1/video/opacity", "args": [] } }
] }
```

| Field | Type | Rules |
|---|---|---|
| `orientation` | `"vertical"` \| `"horizontal"` | Vertical: bottom is `min`. Horizontal: left is `min`. |
| `min`, `max` | number | `min` < `max`. |
| `step` | number | More than 0 and at most `max − min`. Values snap to it, counted from `min`. |
| `start` | number | From `min` to `max`. The value before anyone drags it, and after a server restart. |
| `value` | `{ "at": number, "as": "f" \| "i" }` | Where the value goes in an OSC command: inserted before argument `at` (0 = first, the number of arguments = last), sent as a 32-bit float or integer. `"i"` needs a whole-number `step`. |

A fader also follows these rules: its `action.goTo` is `null` and its `pressEffect` is `"none"`.
Its command, if any, says where the value goes:

- **OSC** — `value.at` and `value.as` above: the value is an argument of its own.
- **UDP** — `{value}` in `text`, e.g. `"VOL {value}\r"`.
- **HTTP** — `{value}` in `path` or `body` (at least one), e.g. `"/dimmer/{value}"` or
  `"{ \"level\": {value} }"`.

Every `{value}` is replaced by the value as text: a whole number when `step` and `min` are whole
numbers (`128`), otherwise up to 3 decimals without trailing zeros (`0.75`, `0.333`). In a
button's command `{value}` has no meaning and is sent as it is written.

A hotspot with `fill: null`, `border: null` and no frost, image or text is **invisible** — the
most common case when the button is drawn on the background.

## 6. Target

A named destination for commands. The `protocol` field decides which other fields exist.

```json
{ "id": "t_r2k8sd", "name": "Resolume", "protocol": "osc-udp", "host": "192.168.1.20", "port": 7000 }
```

| `protocol` | Fields | Rules |
|---|---|---|
| `"osc-udp"` | `host`, `port` | `host`: IPv4 address or hostname. `port`: 1–65535. |
| `"udp"` | `host`, `port` | Same as above. |
| `"http"` | `baseUrl` | Absolute `http://` or `https://` URL, e.g. `http://192.168.1.30:8080`. |

Common fields: `id` ([Id](#92-ids), unique among targets) and `name` (1–100 characters).

## 7. Action

```json
{
  "goTo": "p_7tn4vb",
  "commands": [
    { "command": { ... } },
    { "delayMs": 2500, "name": "Lights up", "command": { ... } },
    { "delayMs": 1000, "enabled": false, "command": { ... } }
  ]
}
```

| Field | Type | Rules |
|---|---|---|
| `goTo` | page [Id](#92-ids) \| `null` | Must reference an existing page. `null` = stay. |
| `commands` | list of Steps | 0–20 steps, sent in order ([ADR 0022](adr/0022-command-sequences.md)). An empty list sends nothing. |

**Step**

| Field | Type | Rules |
|---|---|---|
| `delayMs` | integer, optional | 0–60000. Milliseconds to wait before this step is sent; absent = 0. |
| `name` | string, optional | 0–100 characters. Shown in the editor and the command log instead of the step's number. |
| `enabled` | boolean, optional | `false` switches the step off; absent or `true` = on. A step that is off is skipped with its pause, as if it were not in the list, and is not counted in "step 2 of 3" ([spec ACT-9](spec.md#55-actions)). It is still validated: its target must exist, so it works when switched back on. |
| `command` | Command | See below. Each step has its own target. |

`goTo` may be `null` and `commands` empty (a hotspot that only plays its press effect). The first
step without a delay is sent at once and the page changes right after the tap; later steps are
sent by the server on its own timers, after the tablet has moved on
([spec ACT-2](spec.md#55-actions), ACT-5 to ACT-8). A fader has at most one step, with no delay;
switched off, a drag sends nothing. When every step is off, a tap sends nothing.

**Command** — `type` must equal the `protocol` of the referenced target.

| `type` | Fields | Rules |
|---|---|---|
| `"osc-udp"` | `targetId`, `address`, `args` | `address` starts with `/`, no spaces. `args`: list of `{ "type": "i" \| "f" \| "s", "value": … }` — 32-bit integer, 32-bit float, string. |
| `"udp"` | `targetId`, `text` | 1–1024 characters, sent as UTF-8. Line endings must be written explicitly (`"PLAY\r\n"`). |
| `"http"` | `targetId`, `method`, `path`, `body` | `method`: `"GET"` \| `"POST"` \| `"PUT"`. `path` starts with `/` and is appended to the target's `baseUrl`. `body`: string or `null`; only allowed with `POST` and `PUT`, sent as `text/plain` unless it is valid JSON, then `application/json`. |

Example OSC arguments:

```json
"args": [ { "type": "i", "value": 1 }, { "type": "f", "value": 0.5 }, { "type": "s", "value": "intro" } ]
```

## 8. Station

```json
{ "id": "main", "name": "Main catalog", "startPageId": "p_h8x2kq", "idleTimeoutSeconds": 60 }
```

| Field | Type | Rules |
|---|---|---|
| `id` | slug | `a–z`, `0–9`, `-`; 1–40 characters; unique among stations; not `test`, which marks test sends from the editor ([spec TGT-6](spec.md#56-targets-and-drivers)). Part of the player URL `/play/<id>`, so it is human-readable. Changing it breaks the URL on already configured tablets. |
| `name` | string | 1–100 characters. |
| `startPageId` | page [Id](#92-ids) | Must reference an existing page. |
| `idleTimeoutSeconds` | integer \| `null` | 5–3600. `null` = never return automatically. |

## 9. Common types

### 9.1 Color

`"#RRGGBB"`, hexadecimal, case-insensitive (e.g. `"#3A7BFF"`). Transparency is set
separately (`style.opacity`), so there is one way to express it.

### 9.2 IDs

Page, hotspot and target IDs are generated by the editor: a type prefix and six random
characters (`p_`, `h_`, `t_` + `[a-z0-9]{6}`). They never change after creation, so renaming
something never breaks references. Station IDs are the exception: they are human-readable
slugs because they appear in URLs.

### 9.3 Asset paths

`"assets/<file name>"`. The file name contains only `A–Z a–z 0–9 . _ -`, no folders, no
`..`. The server checks that the file exists when the project is loaded or saved.

## 10. Validation

Validation happens in two layers:

1. **Shape** — every field has the right type and range (the tables above). Unknown fields are rejected,
   so a typo in a hand-edited file is reported instead of being silently dropped on the next save.
2. **References** — checked across the whole project:
   - all IDs are unique within their kind;
   - every `goTo` and `startPageId` points to an existing page;
   - every step's `command.targetId` points to an existing target, and `command.type` matches that target's `protocol`;
   - a fader has at most one step, and it has no delay;
   - every hotspot lies inside the canvas;
   - every asset path points to an existing file *(server only — the file system is not visible to the schema)*.

An invalid project is never saved. Errors name the exact place, e.g.
`pages[2].hotspots[0].action.goTo: page "p_zz0000" does not exist`.

Deleting a page or a target never leaves broken references: the editor operation that
deletes it also clears every `goTo` that pointed to it and removes every step that sent to it. A station whose start page
is deleted starts on the first remaining page, since `startPageId` cannot be empty; for the same
reason the last page of a project cannot be deleted.

## 11. Complete example

```json
{
  "schemaVersion": 2,
  "name": "Demo stand",
  "canvas": { "width": 2048, "height": 1536, "scaleMode": "fit", "backgroundColor": "#000000" },
  "pages": [
    {
      "id": "p_h8x2kq",
      "name": "Home",
      "background": { "type": "video", "asset": "assets/waves.mp4" },
      "hotspots": [
        {
          "id": "h_3mq9za",
          "name": "Product A",
          "x": 120, "y": 400, "width": 500, "height": 300,
          "shape": { "type": "rect", "cornerRadius": 24 },
          "style": { "fill": null, "border": null, "opacity": 1 },
          "pressEffect": "ripple",
          "action": {
            "goTo": "p_7tn4vb",
            "commands": [
              { "command": { "type": "http", "targetId": "t_demo01", "method": "POST",
                             "path": "/demo/screen-1/product-a", "body": null } },
              { "delayMs": 1500, "name": "Second screen",
                "command": { "type": "http", "targetId": "t_demo01", "method": "POST",
                             "path": "/demo/screen-2/product-a", "body": null } },
              { "delayMs": 3000, "enabled": false,
                "command": { "type": "http", "targetId": "t_demo01", "method": "POST",
                             "path": "/demo/lights/product-a", "body": null } }
            ]
          }
        }
      ]
    },
    {
      "id": "p_7tn4vb",
      "name": "Product A",
      "background": { "type": "image", "asset": "assets/product-a.jpg" },
      "hotspots": [
        {
          "id": "h_8kd2pl",
          "name": "Back",
          "x": 40, "y": 40, "width": 160, "height": 160,
          "shape": { "type": "ellipse" },
          "style": { "fill": "#FFFFFF", "border": null, "opacity": 0.2 },
          "pressEffect": "highlight",
          "action": { "goTo": "p_h8x2kq", "commands": [] }
        }
      ]
    }
  ],
  "targets": [
    { "id": "t_demo01", "name": "Demo receiver", "protocol": "http", "baseUrl": "http://localhost:4000" }
  ],
  "stations": [
    { "id": "main", "name": "Main catalog", "startPageId": "p_h8x2kq", "idleTimeoutSeconds": 60 }
  ]
}
```

## 12. Versioning

`schemaVersion` changes only when an existing project would no longer be read correctly.
Adding an optional field with a default does not change it. When it changes, the server
upgrades older projects on load with a small migration function per version, and this
document gets a changelog section.

### Changelog

- **Version 2** (Tapcue 0.5, [ADR 0022](adr/0022-command-sequences.md)): `action.command` became
  `action.commands`, a list of steps with an optional delay. A version 1 project is upgraded
  wherever it is read (loading, import, the projects list): `"command": X` becomes
  `"commands": [{ "command": X }]` and `"command": null` becomes `"commands": []`. The file on disk
  keeps version 1 until the next save. Error messages name the upgraded fields, e.g.
  `action.commands[0].command.targetId` for what the file calls `action.command.targetId`.
  Tapcue 0.4 and older refuse a version 2 project.
- **Version 2, Tapcue 0.6:** a step may have a `name` and `enabled` (both optional, so the version
  stays 2). Tapcue 0.5 refuses a project that uses them, since a step has no other fields there.
