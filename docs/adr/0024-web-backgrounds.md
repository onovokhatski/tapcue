# 0024. Web backgrounds: a site in a frame under the hotspots

Status: Accepted · Date: 2026-11-25

## Context
A stand often needs a live page: the client's own site, a product configurator, a map or a video
player. Today a page background is an image or a video ([spec PG-2](../spec.md#53-pages)), so the
only way to show a site is a screenshot. The integrator wants the site itself as the background,
usable by visitors, with Tapcue hotspots on top that lead back to the stand's own pages.

Decided with the user on 2026-11-25:
- the background can be an online address or a mini-site uploaded as a .zip;
- the site is loaded afresh on every visit to the page;
- on such a page, the idle return uses a project-wide "web page time" set in the Settings tab.

Two limits of the web shape the design:
- **Embedding.** Many sites forbid being shown in a frame with `X-Frame-Options` or a CSP
  `frame-ancestors` directive; the browser then shows an empty frame.
- **Cross-origin isolation.** A page cannot see what happens inside a frame from another origin,
  taps included.

## Decision
- **The site is an `<iframe>` below the hotspot layer.** Hotspots work as on any page; a tap
  anywhere else goes to the site, which can be scrolled and used. A hotspot drawn as a visible
  button is the way back; no separate back bar is added.
- **The frame covers the page area in real screen pixels.** It is not scaled with the canvas: a
  site laid out for 2048 px and shrunk to an iPad would have unreadable text. The site lays itself
  out for the size it gets. Hotspots stay in canvas pixels, so they cannot follow elements of a
  site that reflows or scrolls; the editor recommends visible hotspots at the edges for web pages.
- **Sandboxed:** `allow-scripts allow-same-origin allow-forms`, without `allow-top-navigation`,
  `allow-popups` or `allow-downloads`. A site can neither take the player away from its page nor
  open windows the visitor cannot close.
- **A mini-site is unpacked under the project's assets** into a folder of its own and served by
  the Tapcue server, from the same origin as the player. It works without internet, can always be
  embedded, and, being same-origin, lets the player listen for taps inside it. A mini-site is
  trusted content, as the artwork is: it comes from the integrator who also edits the project.
- **Fresh on every visit:** the frame is created when the page is shown and removed when it is
  left. The next visitor never finds someone else's scroll position or form.
- **Ready before the fade, with a limit:** a page change waits for the frame's `load` event, as
  it waits for an image ([PG-5](../spec.md#53-pages)), but at most 3 s, then fades anyway. A slow
  site must not freeze the stand.
- **Web page time instead of the station's idle timeout.** On a page with a web background, the
  player returns to the station's start page after the project's web page time (default 180 s):
  - for an online site, counted from opening the page, since taps inside cannot be seen;
  - for a mini-site, counted from the last tap, inside the site or on a hotspot.
  A station without an idle timeout never returns, on web pages too.
- **The editor checks an online address before it is used.** The server fetches it, following
  redirects, and reads the headers a browser obeys. A CSP `frame-ancestors` directive decides
  alone when there is one, as in browsers; it allows the stand only with `*` or `http:`, since the
  stand's own address is not known in advance and it is served over http. Otherwise
  `X-Frame-Options: DENY` or `SAMEORIGIN` blocks embedding; browsers ignore other values. The
  check is refused in demo mode, where a public server would fetch any address on request. A blocked address is not applied. The check fetches only http and https
  addresses and returns a verdict, never the page, so it cannot be used to read other machines on
  the stand's network.
- **In the editor the site is shown live but inert** (`pointer-events: none`) under the selection
  layer, so clicks select and drag hotspots. It is laid out at half the canvas size, as a tablet
  with two screen pixels per CSS pixel lays it out (1024 × 768 for a 2048 × 1536 canvas, an iPad),
  and shrunk to the preview, so hotspots are placed over the layout the tablet will show.

## Alternatives considered
- **A web page opened over the page, with a back button.** A second kind of screen with its own
  layout and settings. A web background reuses pages, hotspots, transitions and styles, and the
  way back is an ordinary hotspot the designer draws.
- **Proxying online sites through the Tapcue server** to strip the embedding headers. Fragile
  (scripts, cookies and sign-ins break), it bypasses the site owner's decision, and it adds
  rewriting code where it does not belong.
- **A native wrapper (Electron or Capacitor with a WebView)** can show any site. It would replace
  "open a URL on any tablet" with an app to install on each one, for an edge case the mini-site
  covers.
- **Scaling the frame with the canvas.** Pixel-exact with the artwork, but a site's text becomes
  unreadable on smaller screens, and touch targets shrink with it.
- **Keeping the site loaded between visits.** Faster to come back to, but the next visitor gets
  the last one's state, and a tablet holds several live sites in memory.

## Consequences
- Any site that allows embedding, and every mini-site, can be a page of the stand.
- Sites that forbid embedding cannot be used; the editor says so at once.
- An online site needs internet on the stand; a mini-site does not.
- Taps inside an online site do not keep the station from going idle; the web page time is the
  integrator's control over that.
- The project format gets a third background type and one project setting
  ([project format §4, §2](../project-format.md#4-page)); older apps refuse projects that use them.
