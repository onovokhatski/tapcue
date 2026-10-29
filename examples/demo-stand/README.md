# Demo stand

The project used by the tests, the server's demo mode and the demo receiver (spec DEMO-2).
It follows the design prototype: a fictional audio brand, four pages, three targets and two stations.

| Page | Background | Hotspots |
|---|---|---|
| Home | `home.jpg` | Product A, B and C cards (OSC to Resolume), About, Call our team (HTTP) |
| Product A | `product-a.jpg` | Back, Play demo (HTTP to the demo receiver), Next product |
| Product B | `product-b.jpg` | Back, Play demo (HTTP), Show on the wall (UDP to the projector) |
| About us | `about-loop.mp4` | Back |

Stations: `main` starts on Home, `small` on Product A.

The ids are readable on purpose (`p_home00`, `h_carda0`): this file is written by hand. The
editor generates random ones.

## Assets

`assets/` is generated from the designer's artwork in `docs/design/prototype/src/art`:

- pages are rendered at 2048 × 1536 and saved as JPEG (quality 88, about 0.2 MB each — the
  gradient-heavy PNGs were 1.3–2.5 MB, a lot for every tablet to download over Wi-Fi);
- the About us video is a 6-second H.264 loop at 1920 × 1440, 30 fps, no audio, with the index at
  the start of the file: a soft light circles once per loop, so the last frame leads back to the first.

To rebuild them on macOS:

```bash
examples/demo-stand/make-assets/make-assets.sh
```
