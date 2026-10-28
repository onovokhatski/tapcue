# Tapcue — Project Format

Status: **draft** · Last updated: 2026-10-25 · Schema version: **1**

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

## 2. Top level

```json
{
  "schemaVersion": 1,
  "name": "Demo stand",
  "canvas": { ... },
  "pages": [ ... ],
  "targets": [ ... ],
  "stations": [ ... ]
}
```

| Field | Type | Rules |
|---|---|---|
| `schemaVersion` | integer | Always `1` for this version. The server refuses projects with a version it does not know. |
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
    "command": { "type": "osc-udp", "targetId": "t_r2k8sd",
                 "address": "/composition/columns/2/connect", "args": [] }
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

A hotspot with `fill: null` and `border: null` is **invisible** — the most common case when
the button is drawn on the background.

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
{ "goTo": "p_7tn4vb", "command": { ... } }
```

| Field | Type | Rules |
|---|---|---|
| `goTo` | page [Id](#92-ids) \| `null` | Must reference an existing page. `null` = stay. |
| `command` | Command \| `null` | `null` = send nothing. |

Both may be `null` (a hotspot that only plays its press effect). When both are set, the
command is sent first, then the page changes ([spec ACT-2](spec.md#55-actions)).

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
| `id` | slug | `a–z`, `0–9`, `-`; 1–40 characters; unique among stations. Part of the player URL `/play/<id>`, so it is human-readable. Changing it breaks the URL on already configured tablets. |
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

1. **Shape** — every field has the right type and range (the tables above).
2. **References** — checked across the whole project:
   - all IDs are unique within their kind;
   - every `goTo` and `startPageId` points to an existing page;
   - every `command.targetId` points to an existing target, and `command.type` matches that target's `protocol`;
   - every hotspot lies inside the canvas;
   - every asset path points to an existing file *(server only — the file system is not visible to the schema)*.

An invalid project is never saved. Errors name the exact place, e.g.
`pages[2].hotspots[0].action.goTo: page "p_zz0000" does not exist`.

Deleting a page or a target never leaves broken references: the editor operation that
deletes it also clears every `goTo`, `startPageId` or `command` that pointed to it.

## 11. Complete example

```json
{
  "schemaVersion": 1,
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
            "command": { "type": "http", "targetId": "t_demo01", "method": "POST",
                         "path": "/demo/screen-1/product-a", "body": null }
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
          "action": { "goTo": "p_h8x2kq", "command": null }
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
