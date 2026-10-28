/* Step 10: review and handoff. Everything is rendered from components.js and the live tokens. */

const th = (t, cls = '') => `<th scope="col" class="px-4 py-2 font-semibold ${cls}">${t}</th>`;
const table = (head, rows, min = 760) => `<div class="relative overflow-x-auto rounded-lg border bg-surface"><table class="w-full text-left" style="min-width:${min}px">
  <thead class="border-b bg-subtle"><tr class="text-overline uppercase text-muted">${head.map((h) => th(h)).join('')}</tr></thead>
  <tbody class="divide-y align-top">${rows.map((r) => `<tr>${r.map((c, i) => `<td class="px-4 py-2.5 ${i === 0 ? 'text-label-m' : 'text-body-s text-secondary'}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const code = (t) => `<span class="font-mono text-mono-s text-primary">${t}</span>`;
const yes = (t) => `<span class="inline-flex items-center gap-1 text-success-fg">${icon('check', 'h-3.5 w-3.5')}${t}</span>`;
const na = (t) => `<span class="text-muted">n/a · ${t}</span>`;
const sectionHead = (id, eyebrow, title, note) => `<div id="${id}" class="scroll-mt-20 space-y-1 border-t pt-8"><p class="text-overline uppercase text-muted">${eyebrow}</p><h2 class="text-heading-xl">${title}</h2>${note ? `<p class="max-w-[90ch] text-body-m text-secondary">${note}</p>` : ''}</div>`;
const frameBox = (n, title, note, html) => `<section class="space-y-3"><div class="max-w-[90ch] space-y-1"><p class="text-overline uppercase text-muted">Frame ${n}</p><h3 class="text-heading-l">${title}</h3><p class="text-body-m text-secondary">${note}</p></div>
  <div class="relative overflow-x-auto rounded-lg border bg-surface shadow-1"><div data-frame>${html}</div></div></section>`;

/* ---------- 1. One-off audit ---------- */
const AUDIT = [
  ['Zoom select in the canvas toolbar', 'Pages', 'Replaced by <b>Toolbar meta</b>, a read-only "Fit · 39%" label (decision 3).'],
  ['Empty states built inline', 'Targets, Stations', 'New component <b>Empty state</b> (icon, title, body, one action).'],
  ['Main-column form panels', 'Targets, Stations, Settings', 'New component <b>Form card</b> (title, header action, body).'],
  ['Static dialog markup from the specimen', 'Targets, Settings', '<b>Dialog</b> now has a function with default and danger tones.'],
  ['QR card copies per state', 'Stations', '<b>QR card</b> function with copied and disabled states.'],
  ['"Used by" rows and page-hotspot rows, each hand-built', 'Targets, Pages', 'New component <b>Compact row</b>; also used on "Station not found".'],
  ['"Recent commands" list', 'Targets', 'New variant <b>Log row · compact</b>.'],
  ['URL box drawn as a styled span', 'Demo receiver', 'Replaced by <b>Text field</b> with the new read-only state.'],
  ['"Waiting for the first command" pill', 'Demo receiver', 'Added <b>Status badge</b> states Waiting and Unsaved.'],
  ['Screen tiles', 'Demo receiver', 'New component <b>Screen tile</b> with a "Just changed" state.'],
  ['Fit / Fill diagram', 'Settings', 'New component <b>Scale diagram</b>, computed from the canvas and reference screen.'],
  ['Connection pill with a literal white ring', 'Player', 'Now the <b>Connection indicator</b> class, token colours only; adds a Loading variant.'],
  ['Literal rgb() values in hotspot chips and handles', 'Canvas overlay', 'Replaced with color-mix() of overlay tokens.'],
  ['Press-effect and fade timings written as text', 'Player', 'Now <b>motion tokens</b> (--duration-press-in, --duration-ripple, --duration-page-fade …).'],
  ['List rows as non-focusable divs', 'Pages, Targets, Stations', 'Rows are now buttons, so they are keyboard-reachable.'],
  ['Annotation markers and legend', 'Player P2', 'Kept as a handoff-only annotation kit. Never shipped in the product.'],
  ['Sample artwork colours and fonts', 'Canvas, Player', 'Kept. Artwork is content from the designer, not UI, so it uses no tokens.'],
];

/* ---------- 2. State coverage ---------- */
const STATES = ['Empty', 'Loading', 'Saving', 'Saved', 'Error', 'Disconnected', 'Disabled', 'Demo mode'];
const COVERAGE = [
  ['Pages', yes('F2 no background'), yes('E1 (added)'), yes('F2'), yes('F1, F3a…F5'), yes('F3b upload · E3 save (added)'), yes('E2 (added)'), yes('Ellipse radius, border width, Send test offline'), yes('E4 (added)')],
  ['Targets', yes('T2'), yes('Shell, as E1'), yes('Autosave, as S3'), yes('T1'), yes('T3 invalid'), yes('Shell, as E2'), na('no disabled controls'), yes('Shell badge, as G4')],
  ['Stations', yes('S2'), yes('Shell, as E1'), yes('S3'), yes('S1'), yes('QR card · invalid id'), yes('Shell, as E2'), yes('QR card disabled'), yes('Shell badge, as G4')],
  ['Settings', na('always has a canvas'), yes('Shell, as E1'), yes('Autosave'), yes('G1'), yes('G3 import'), yes('Shell, as E2'), yes('G4 Import'), yes('G4')],
  ['Player', na('a station always has a start page'), yes('P0 (added)'), na('read-only'), na('read-only'), yes('P6 station not found'), yes('P5'), na('no controls'), na('editor only')],
  ['Demo receiver', yes('R1'), na('static page'), na('read-only'), na('read-only'), yes('Request status column'), na('local page'), na('no controls'), na('not part of the editor')],
];

/* ---------- 3. Contrast for pairs introduced after v0.1 ---------- */
const NEW_PAIRS = [
  ['--color-text-on-accent', '--color-accent-default', 'text', '"New", "Just changed", legend numbers'],
  ['--color-warning-fg', '--color-warning-bg', 'text', 'Cropped-hotspot chip on the canvas'],
  ['--color-text-inverse', '--color-bg-inverse', 'text', 'Screen tile content'],
  ['--color-text-primary', '--color-accent-subtle', 'text', 'Fresh request row'],
  ['--color-text-muted', '--color-accent-subtle', 'text', 'Fresh row timestamp'],
  ['--color-text-muted', '--color-danger-bg', 'text', 'Error log row timestamp'],
  ['--color-text-secondary', '--color-danger-bg', 'text', 'Error log row source'],
  ['--color-text-primary', '--color-bg-subtle', 'text', 'Read-only field, toolbar meta'],
  ['--color-text-secondary', '--color-bg-subtle', 'text', 'Toolbar meta, Unsaved badge'],
  ['--color-info-fg', '--color-info-bg', 'text', 'Demo mode badge and banners'],
  ['--color-text-link', '--color-bg-surface', 'text', '"Open" in Used by'],
  ['--color-text-on-accent', '--color-accent-subtle', 'text', 'Scale diagram label'],
  ['--color-overlay-light', '--color-overlay-plate', 'text', 'Connection indicator over white artwork', '#ffffff'],
  ['--color-overlay-light', '--color-overlay-plate', 'text', 'Connection indicator over black artwork', '#000000'],
  ['--color-success-solid', '--color-bg-subtle', 'ui', 'Saved badge check'],
  ['--color-accent-strong', '--color-accent-subtle', 'ui', 'Empty-state icon'],
  ['--color-border-focus', '--color-bg-canvas', 'ui', 'Focus ring on the canvas surround'],
  ['--color-border-focus', '--color-overlay-light', 'ui', 'Hotspot focus ring on its light halo'],
];
function contrastTable() {
  const css = getComputedStyle(document.documentElement), val = (n) => css.getPropertyValue(n).trim();
  const rgba = (str) => { const p = document.createElement('span'); p.style.color = str; document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); const n = c.match(/[\d.]+/g).map(Number); return { r: n[0], g: n[1], b: n[2], a: n[3] ?? 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  let pass = 0;
  const rows = NEW_PAIRS.map(([fg, bg, kind, use, under = '#ffffff']) => {
    const b = blend(rgba(val(bg)), rgba(under)), f = blend(rgba(val(fg)), b);
    const x = lum(f), y = lum(b), r = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05), ok = r >= (kind === 'text' ? 4.5 : 3);
    if (ok) pass++;
    return [code(fg), code(bg), use, `<span class="font-mono text-mono-s tabular">${r.toFixed(2)}:1</span>`, ok ? yes(kind === 'text' ? 'AA text' : 'AA UI') : '<span class="text-danger-fg">Fails</span>'];
  });
  return { html: table(['Foreground', 'Background', 'Used for', 'Ratio', 'Result'], rows), pass, total: NEW_PAIRS.length };
}

/* ---------- 4. Overlay check on real artwork ---------- */
function overlayCheck() {
  const S = 0.25, s = (v) => Math.round(v * S);
  const cases = [
    ['home', 'Light · Home', { 'hs-a': 'selected', 'hs-b': 'hover', 'hs-c': 'focus' }],
    ['product-b', 'Mid-tone · Product B', { 'pb-play': 'selected', 'pb-wall': 'focus' }],
    ['product-a', 'Dark · Product A', { 'pa-play': 'selected', 'pa-next': 'focus' }],
  ];
  return `<div class="flex flex-wrap gap-6 bg-surface p-6">${cases.map(([id, label, st]) => {
    const p = page(id);
    const ov = p.hotspots.map((h) => hotspotOverlay({ x: s(h.x), y: s(h.y), w: s(h.w), h: s(h.h), r: s(h.r || 0), shape: h.shape, name: h.name, state: st[h.id] || 'idle', warn: croppedBy(h, '16:10') > 0 })).join('');
    return `<figure class="space-y-2"><div class="relative" style="width:512px;height:384px"><img src="${p.bg.src}" alt="" class="absolute inset-0 h-full w-full">${ov}</div>
      <figcaption class="text-label-m">${label}</figcaption></figure>`;
  }).join('')}</div>`;
}

/* ---------- 5. Handoff: component inventory ---------- */
const INVENTORY = [
  ['Icon', 'plus, trash, copy, external, chevron-down, grip, close, check, alert, wifi-off, arrow-right, info, image, video, upload, crop, download', '—', 'name, className', 'icon()'],
  ['Button', 'Primary, Secondary, Ghost, Danger · size M 32 / S 28 · icon-only · toggle', 'Default, Hover, Pressed, Disabled, Focus, Busy, Toggle on', 'variant, size, icon, label, ariaLabel, disabled, pressed, busy', 'button()'],
  ['Text field', 'Single line, multiline · mono · size M / S · prefix', 'Default, Focus, Error, Disabled, Read-only', 'id, label, value, placeholder, helper, error, mono, multiline, rows, prefix, size, disabled, readonly', 'textField()'],
  ['Select', 'Size M / S · with meta', 'Default, Hover, Open, Disabled', 'id, label, value, meta, options, placeholder, size, helper, disabled', 'select()'],
  ['Number field', 'Prefix (axis), suffix (unit)', 'Default, Focus, Error, Disabled', 'prefix, suffix, value, min, max, step, error, disabled', 'numberField()'],
  ['Colour field', 'Set, None', 'Default, Focus, Error, Disabled', 'value (hex | null), allowNone, ariaLabel, error, disabled', 'colorField()'],
  ['Segmented control', '2–3 options', 'Selected, Unselected, Hover, Focus, Disabled', 'label, options, value, disabled', 'segmented()'],
  ['Tab / Top bar', 'Pages, Targets, Stations, Settings', 'Active, Inactive, Hover, Focus', 'tab, conn, save, demo', 'topBar()'],
  ['Shell', 'With list, without list, with banner, with modal', '—', 'tab, body, collapsed, save, conn, demo, logRows, modal, banner', 'shell()'],
  ['Shell banner', 'Info, Warning, Error', '—', 'tone, title, body, action', 'shellBanner()'],
  ['List item · page', 'Thumbnail, grip, delete', 'Default, Hover, Selected, Focus, Dragging, Drop position, Renaming', 'page, selected, hover', 'pageListItem()'],
  ['List item · text', 'Title + meta', 'Default, Hover, Selected, Warning', 'title, meta, selected, warn', 'textRow()'],
  ['List panel', 'Targets, Stations', 'Populated, Empty', 'title, items, addLabel, empty', 'listPanel()'],
  ['Compact row', 'Optional lead, meta, trailing', 'Default, Hover, Focus', 'lead, title, meta, trailing', 'compactRow()'],
  ['Status badge', 'Connected, Disconnected, Saving, Saved, Error, Sent, Unsaved, Waiting, Demo', '—', 'status, label', 'badge()'],
  ['Test tag', '—', '—', '—', 'testTag()'],
  ['Log row', 'Table · compact', 'Sent, Error, Navigation, Fresh', 'time, result, source, hotspot, target, command, args, navigateTo, error', 'logRow(), logRowCompact()'],
  ['Command log', 'Expanded 176 px, collapsed 36 px', 'Populated, Empty', 'collapsed, rows', 'logPanel()'],
  ['Hotspot overlay', 'Rectangle, Ellipse', 'Idle, Hover, Selected, Focus × Cropped warning', 'shape, state, name, radius, x, y, w, h, warn, chipBelow', 'hotspotOverlay()'],
  ['Safe-area overlay', '16:10, 16:9 reference', '—', 'reference, scale', '.crop-zone, .safe-line, .canvas-chip'],
  ['Empty canvas', '—', '—', '—', '.canvas-empty'],
  ['Toolbar meta', '—', 'Read-only', 'text, label', 'toolbarMeta()'],
  ['Panel section · Form row', '—', '—', 'title, action, body / label, control', 'panelSection(), formRow()'],
  ['Form card', '—', '—', 'title, action, body', 'formCard()'],
  ['Empty state', '—', '—', 'icon, title, body, action', 'emptyState()'],
  ['Upload dropzone', '—', 'Default, Drag over, Disabled (demo)', 'active, disabled', 'dropzone()'],
  ['File row', 'Image, Video', 'Ready, Uploading', 'type, name, meta, actions, progress', 'fileRow()'],
  ['Progress bar', '—', '0–100', 'value, label', 'progress()'],
  ['Banner', 'Info, Warning, Error', 'Dismissible', 'tone, title, body, action, dismissible', 'banner()'],
  ['Dialog', 'Default, Danger', 'Initial focus on Cancel for Danger', 'tone, title, body, confirmLabel, cancelLabel, confirmIcon', 'dialog()'],
  ['QR card', '—', 'Default, Copied, Disabled', 'url, qr, copied, disabled', 'qrCard()'],
  ['Scale diagram', 'Fit, Fill × 16:10, 16:9', '—', 'mode, ref, width', 'scaleDiagram()'],
  ['Screen tile', '—', 'Playing, Just changed', 'name, content, since, source, fresh', 'screenTile()'],
  ['Connection indicator', 'Reconnecting, Loading', 'Visible only while needed', 'kind', '.tc-indicator'],
  ['Skeleton', '—', 'Pulsing', 'className', 'skeleton()'],
];
const PER_SCREEN = [
  ['Pages', 'Shell, Top bar, Status badge, Page list item, Button (primary, toggle, ghost, icon-only), Select, Toolbar meta, Hotspot overlay, Safe-area overlay, Empty canvas, Panel section, Text field, Number field, Colour field, Segmented control, Banner, Dropzone, File row, Progress bar, Compact row, Command log, Log row, Test tag, Shell banner, Skeleton'],
  ['Targets', 'Shell, Top bar, List panel, List item · text, Form card, Text field, Segmented control, Compact row, Log row · compact, Empty state, Dialog (danger), Command log'],
  ['Stations', 'Shell, Top bar, List panel, List item · text, Form card, Text field (prefix), Select, Segmented control, Number field, Banner (warning), QR card, Empty state, Command log'],
  ['Settings', 'Shell, Top bar, Form card, Number field, Colour field, Segmented control, Scale diagram, Banner (info, error), Button, Dialog (default), Status badge (demo), Command log (collapsed)'],
  ['Player', 'Artwork only · Connection indicator (reconnecting, loading) · "Station not found": Compact row, Icon. Handoff annotations are not shipped.'],
  ['Demo receiver', 'Status badge (waiting, connected), Button, Text field (read-only), Screen tile, Log table rows, Empty-state card'],
];
