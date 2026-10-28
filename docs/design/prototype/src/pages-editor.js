/* Pages editor screen: composed only from components.js */

const FRAME_W = 1440, FRAME_H = 900, LEFT_W = 264, RIGHT_W = 320, TOPBAR_H = 48, TOOLBAR_H = 44;
/* Editor breakpoints (see the handoff page):
   wide    >= 1440 px: page list 264, properties 320
   compact 1280-1439: page rail 72 (list opens as an overlay drawer), properties 304
   < 1280 or < 720 tall: "needs a wider window" notice */
const EDITOR_LAYOUT = { wide: { left: 264, right: 320 }, compact: { left: 72, right: 304 } };
const LOG_H = { open: 176, collapsed: 36 };

/* ---------- Left: page list ---------- */
function pageMeta(p) {
  const n = p.hotspots.length;
  const bg = !p.bg ? 'No background' : p.bg.type === 'video' ? `Video ${p.bg.duration}` : 'Image';
  const start = PROJECT.stations.some((s) => s.start === p.id) ? ' · Start' : '';
  return `${n} hotspot${n === 1 ? '' : 's'} · ${bg}${start}`;
}
function pageThumb(p) {
  return p.bg
    ? `<img src="${p.bg.src}" alt="" class="h-9 w-12 flex-none rounded-sm border object-cover shadow-1">`
    : `<span class="flex h-9 w-12 flex-none items-center justify-center rounded-sm border border-dashed border-strong bg-subtle text-muted">${icon('image', 'h-3.5 w-3.5')}</span>`;
}
function pageListItem(p, { selected, hover }) {
  const state = selected ? 'border-selection bg-selection' : hover ? 'border-transparent bg-hover' : 'border-transparent hover:bg-hover';
  return `<li><div ${selected ? 'aria-current="true"' : ''} class="flex items-center gap-2 rounded border p-1.5 pr-2 ${state}">
    <span class="cursor-grab ${selected || hover ? 'text-secondary' : 'text-muted'}" aria-hidden="true">${icon('grip')}</span>
    <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left">${pageThumb(p)}
    <span class="min-w-0 flex-1"><span class="block truncate text-label-m">${esc(p.name)}</span><span class="block truncate text-body-s ${selected ? 'text-secondary' : 'text-muted'}">${pageMeta(p)}</span></span></button>
    ${selected || hover ? button({ variant: 'ghost', size: 's', icon: 'trash', ariaLabel: `Delete page ${p.name}` }) : ''}
  </div></li>`;
}
function pagesPanel(pages, selectedId, hoverId) {
  return `<aside aria-label="Pages" class="flex w-[264px] flex-none flex-col border-r bg-surface">
    <div class="flex h-11 flex-none items-center justify-between border-b pl-4 pr-2">
      <h2 class="text-label-m">Pages <span class="text-body-s text-muted">${pages.length}</span></h2>
      ${button({ variant: 'ghost', size: 's', icon: 'plus', label: 'Add page' })}
    </div>
    <ul class="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">${pages.map((p) => pageListItem(p, { selected: p.id === selectedId, hover: p.id === hoverId })).join('')}</ul>
    <p class="border-t px-4 py-2.5 text-body-s text-muted">Drag to reorder. Order sets the page list in selects only; visitors move between pages by tapping.</p>
  </aside>`;
}

function pagesRail(pages, selectedId, drawerOpen) {
  const items = pages.map((p) => {
    const sel = p.id === selectedId;
    return `<li><button type="button" aria-label="${esc(p.name)}, ${pageMeta(p)}" ${sel ? 'aria-current="true"' : ''} class="flex w-[60px] flex-col items-center gap-1 rounded border p-1 ${sel ? 'border-selection bg-selection' : 'border-transparent hover:bg-hover'}">
      ${pageThumb(p)}<span class="line-clamp-2 w-full break-words text-center text-body-s leading-[14px] ${sel ? 'text-primary' : 'text-secondary'}">${esc(p.name)}</span></button></li>`;
  }).join('');
  return `<aside aria-label="Pages" class="flex w-[72px] flex-none flex-col items-center border-r bg-surface">
    <div class="flex h-11 w-full flex-none items-center justify-center border-b">${button({ variant: 'ghost', size: 's', icon: 'panel-left', ariaLabel: drawerOpen ? 'Hide page list' : 'Show page list', pressed: !!drawerOpen })}</div>
    <ul class="min-h-0 flex-1 space-y-1 overflow-y-auto py-2">${items}</ul>
    <div class="flex h-11 w-full flex-none items-center justify-center border-t">${button({ variant: 'ghost', size: 's', icon: 'plus', ariaLabel: 'Add page' })}</div>
  </aside>`;
}

/* ---------- Centre: toolbar + canvas ---------- */
function canvasToolbar({ safe, zoom, addDisabled, ref }) {
  return `<div class="flex h-11 flex-none items-center gap-2 border-b bg-surface px-3">
    ${button({ variant: 'primary', icon: 'plus', label: 'Add hotspot', disabled: addDisabled })}
    <span class="mx-1 h-5 w-px bg-pressed" aria-hidden="true"></span>
    ${button({ icon: 'crop', label: 'Show safe area', pressed: !!safe })}
    ${PROJECT.canvas.scale === 'fill' ? `<span id="ref-l" class="ml-2 text-label-s text-secondary">Reference screen</span><div class="w-[180px]">${select({ id: 'ref-screen', ariaLabel: 'Reference screen, saved in this browser', value: REFERENCE[ref].label, size: 's' })}</div>` : ''}
    <div class="ml-auto">${toolbarMeta(`Fit · ${zoom}%`, `Canvas scale ${zoom} percent`)}</div>
  </div>`;
}

function canvasStage({ p, scale, selectedId, hoverId, safe, upload, ref }) {
  const W = Math.round(PROJECT.canvas.w * scale), H = Math.round(PROJECT.canvas.h * scale);
  const s = (v) => Math.round(v * scale);
  const bg = p.bg ? `<img src="${p.bg.src}" alt="${esc(p.name)} background" class="absolute inset-0 h-full w-full">` : '';
  let empty = '';
  if (!p.bg && upload === 'uploading') {
    empty = `<div class="absolute inset-0 flex items-center justify-center"><div class="w-[300px] space-y-2 rounded-lg bg-surface p-4 shadow-2">
      <p class="flex items-center gap-2 text-label-m">${icon('video', 'text-secondary')}Uploading about-loop.mp4</p>
      ${progress({ value: 64, label: 'Uploading about-loop.mp4' })}
      <p class="flex justify-between text-body-s text-muted"><span class="tabular">82 of 128 MB</span><span>about 6 s left</span></p></div></div>`;
  } else if (!p.bg) {
    empty = `<div class="canvas-empty absolute inset-4 flex flex-col items-center justify-center gap-2 rounded-lg text-center">
      ${icon('upload', 'h-6 w-6')}<p class="text-label-m">No background yet</p>
      <p class="max-w-[300px] text-body-s opacity-80">Drop an image or video here, or choose a file in the panel. Hotspots stay where they are.</p></div>`;
  }
  const overlays = p.hotspots.map((h) => hotspotOverlay({
    x: s(h.x), y: s(h.y), w: s(h.w), h: s(h.h), r: s(h.r || 0), shape: h.shape, name: h.name,
    state: h.id === selectedId ? 'selected' : h.id === hoverId ? 'hover' : 'idle', warn: croppedBy(h, ref) > 0, chipBelow: s(h.y) < 28,
  })).join('');
  const band = cropBands(ref).top;
  const crop = safe && PROJECT.canvas.scale === 'fill' ? (() => {
    const c = s(band);
    return `<div class="crop-zone top-0" style="height:${c}px"></div><div class="crop-zone bottom-0" style="height:${c}px"></div>
      <div class="safe-line" style="top:${c}px"></div><div class="safe-line" style="top:${H - c}px"></div>
      <span class="canvas-chip absolute left-2 top-2">${icon('crop', 'h-3 w-3')}Cropped on ${ref} in Fill · ${band} px</span>
      <span class="canvas-chip absolute bottom-2 left-2">${icon('crop', 'h-3 w-3')}Cropped on ${ref} in Fill · ${band} px</span>`;
  })() : '';
  return `<div class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-canvas">
    <div class="relative shadow-2" style="width:${W}px;height:${H}px;background:${PROJECT.canvas.bg}" aria-label="Canvas, ${esc(p.name)}, 2048 × 1536" role="img">
      ${bg}${empty}${crop}${overlays}
    </div>
    <span class="absolute bottom-2 right-3 font-mono text-mono-s text-secondary">2048 × 1536</span>
  </div>`;
}

/* ---------- Right: properties ---------- */
function commandFields(h) {
  const t = target(h.target);
  if (!t) return `<p class="text-body-s text-muted">This hotspot sends no command. Choose a target to send one.</p>`;
  if (t.protocol === 'osc') {
    const args = h.osc.args.map((a, i) => `<li class="grid grid-cols-[80px_minmax(0,1fr)_28px] items-center gap-2">
      ${select({ id: `arg-${i}-type`, ariaLabel: `Argument ${i + 1} type`, value: a.type, size: 's' })}
      ${textField({ id: `arg-${i}-val`, ariaLabel: `Argument ${i + 1} value`, value: a.value, mono: true, size: 's' })}
      ${button({ variant: 'ghost', size: 's', icon: 'trash', ariaLabel: `Remove argument ${i + 1}` })}</li>`).join('');
    return `${textField({ id: 'osc-address', label: 'OSC address', value: h.osc.address, mono: true, size: 's' })}
      <div class="space-y-1.5"><p class="text-label-s text-secondary">Arguments</p><ul class="space-y-1.5">${args}</ul>
      ${button({ variant: 'ghost', size: 's', icon: 'plus', label: 'Add argument', cls: '-ml-2' })}</div>`;
  }
  if (t.protocol === 'udp') {
    return textField({ id: 'udp-text', label: 'Text', value: h.udp.text, mono: true, multiline: true, rows: 2, helper: 'Sent as UTF-8. Write \\r or \\n for line endings.' });
  }
  return `<div class="space-y-1"><p class="text-label-s text-secondary">Method</p>${segmented({ label: 'HTTP method', options: ['GET', 'POST', 'PUT'], value: h.http.method })}</div>
    ${textField({ id: 'http-path', label: 'Path', value: h.http.path, mono: true, size: 's', helper: `Appended to <span class="font-mono text-mono-s">${t.baseUrl}</span>` })}
    ${textField({ id: 'http-body', label: 'Body', value: h.http.body, mono: true, multiline: true, rows: 2, placeholder: 'Empty', helper: 'Sent as-is. Times out after 2 s.' })}`;
}

function hotspotProps(h, { tested, ref, offline } = {}) {
  const cut = croppedBy(h, ref), band = cropBands(ref).top, edge = h.y < band ? 'top' : 'bottom';
  const t = target(h.target);
  const goto = h.goto ? page(h.goto).name : null;
  const header = `<div class="space-y-3 border-b px-4 py-4">
    <div class="flex items-center justify-between"><h2 class="text-overline uppercase text-muted">Hotspot</h2>
      <div class="-mr-1 flex gap-0.5">${button({ variant: 'ghost', size: 's', icon: 'copy', ariaLabel: 'Duplicate hotspot' })}${button({ variant: 'ghost', size: 's', icon: 'trash', ariaLabel: 'Delete hotspot' })}</div></div>
    ${textField({ id: 'hs-name', label: 'Name', value: h.name, size: 's' })}
    ${cut ? banner({ tone: 'warning', title: 'Partly outside the safe area', body: `Its ${edge} ${cut} px are cropped on ${ref} screens in Fill mode. Move it ${edge === 'top' ? 'down' : 'up'} ${cut} px, or use Fit in Settings.` }) : ''}
  </div>`;
  const geometry = panelSection({ title: 'Position and size', body: `<div class="grid grid-cols-4 gap-1.5">
      ${numberField({ prefix: 'X', value: h.x })}${numberField({ prefix: 'Y', value: h.y })}${numberField({ prefix: 'W', value: h.w })}${numberField({ prefix: 'H', value: h.h })}</div>
    <div class="flex items-center gap-2">${segmented({ label: 'Shape', options: ['Rectangle', 'Ellipse'], value: h.shape === 'ellipse' ? 'Ellipse' : 'Rectangle' })}
      <div class="w-[96px]">${numberField({ prefix: 'R', value: h.shape === 'ellipse' ? '–' : h.r, suffix: 'px', disabled: h.shape === 'ellipse', ariaLabel: 'Corner radius' })}</div></div>` });
  const style = panelSection({ title: 'Style', body: `
    <div class="grid grid-cols-2 gap-x-2 gap-y-3">
      <div class="space-y-1"><p class="text-label-s text-secondary">Fill</p>${colorField({ ariaLabel: 'fill' })}</div>
      <div class="space-y-1"><p class="text-label-s text-secondary">Opacity</p>${numberField({ value: 100, suffix: '%', ariaLabel: 'Opacity' })}</div>
      <div class="space-y-1"><p class="text-label-s text-secondary">Border</p>${colorField({ ariaLabel: 'border' })}</div>
      <div class="space-y-1"><p class="text-label-s text-secondary">Border width</p>${numberField({ value: 2, suffix: 'px', disabled: true, ariaLabel: 'Border width' })}</div>
    </div>
    <p class="text-body-s text-muted">No fill and no border: visitors see only the artwork.</p>
    ${select({ id: 'effect', label: 'Press effect', value: { 'press-in': 'Press-in', highlight: 'Highlight', ripple: 'Ripple' }[h.effect], size: 's' })}` });
  const testRow = t ? `<div class="space-y-1.5 border-t pt-3"><div class="flex items-center gap-3">${button({ icon: 'arrow-right', label: 'Send test', disabled: offline })}
      ${tested ? `<span class="inline-flex items-center gap-1 text-body-s text-success-fg" role="status">${icon('check', 'h-3.5 w-3.5')}Sent at <span class="font-mono text-mono-s">14:32:05</span></span>` : ''}</div>
      <p class="text-body-s text-muted">${offline ? 'Available when the connection to the server is back.' : 'Sends the command through the server like a real tap. Does not change page.'}</p></div>` : '';
  const onTap = panelSection({ title: 'On tap', body: `
    ${select({ id: 'goto', label: 'Go to page', value: goto, placeholder: 'Stay on this page', size: 's' })}
    ${select({ id: 'target', label: 'Send command to', value: t && t.name, meta: t && PROTOCOL_LABEL[t.protocol], placeholder: 'No command', size: 's',
      helper: t ? `<span class="font-mono text-mono-s">${t.protocol === 'http' ? t.baseUrl : `${t.host}:${t.port}`}</span>` : '' })}
    ${commandFields(h)}${testRow}` });
  return header + onTap + geometry + style;
}

function pageProps(p, { upload, demo } = {}) {
  const header = `<div class="space-y-3 border-b px-4 py-4">
    <div class="flex items-center justify-between"><h2 class="text-overline uppercase text-muted">Page</h2>${button({ variant: 'ghost', size: 's', icon: 'trash', ariaLabel: 'Delete page', cls: '-mr-1' })}</div>
    ${textField({ id: 'page-name', label: 'Name', value: p.name, size: 's' })}</div>`;
  let bgBody;
  if (upload === 'uploading') {
    bgBody = fileRow({ type: 'video', name: 'about-loop.mp4', meta: '<span class="tabular">64% · 82 of 128 MB</span>', progressValue: 64, actions: button({ variant: 'ghost', size: 's', label: 'Cancel' }) })
      + `<p class="text-body-s text-muted">You can keep editing while it uploads.</p>`;
  } else if (upload === 'error') {
    bgBody = banner({ tone: 'error', title: 'Upload failed', body: 'about-loop.mov is 312 MB. The limit is 200 MB. Export a smaller file (H.264 MP4 works well) and try again.', dismissible: true }) + dropzone();
  } else if (p.bg) {
    bgBody = `<img src="${p.bg.src}" alt="" class="aspect-[4/3] w-full rounded border object-cover">` + fileRow({ type: p.bg.type, name: p.bg.file, meta: `${p.bg.type === 'video' ? 'Video · loops, muted' : 'Image'} · 2048 × 1536 · ${p.bg.size}`, actions: button({ variant: 'ghost', size: 's', label: 'Replace' }) });
  } else if (demo) {
    bgBody = dropzone({ disabled: true });
  } else {
    bgBody = dropzone();
  }
  const hs = p.hotspots.map((h) => compactRow({
    lead: `<span class="h-3 w-4 flex-none border-[1.5px] border-strong ${h.shape === 'ellipse' ? 'rounded-full' : 'rounded-sm'}" aria-hidden="true"></span>`,
    title: esc(h.name),
    meta: `${h.goto ? `→ ${esc(page(h.goto).name)}` : ''}${h.goto && h.target ? ' · ' : ''}${h.target ? esc(target(h.target).name) : ''}`,
  })).join('');
  const starts = PROJECT.stations.filter((s) => s.start === p.id).map((s) => s.name);
  return header
    + panelSection({ title: 'Background', body: bgBody })
    + panelSection({ title: `Hotspots on this page · ${p.hotspots.length}`, body: `<ul class="-mx-2 space-y-0.5">${hs}</ul>` })
    + panelSection({ title: 'Start page of', body: `<p class="text-body-m ${starts.length ? '' : 'text-muted'}">${starts.length ? starts.join(', ') : 'No station starts here.'}</p>` });
}

/* ---------- Whole screen ---------- */
function pagesEditor({ pageId, pageOverride, selectedId, hoverId, listHoverId, safe, collapsed, save = 'saved', conn = 'connected', upload, tested, ref = '16:10', shellBanner = '', bannerH = 0, modal = '', demo, w = FRAME_W, h: frameH = FRAME_H, drawer }) {
  const layout = w >= 1440 ? 'wide' : 'compact', L = EDITOR_LAYOUT[layout];
  const pages = PROJECT.pages.map((p) => (pageOverride && p.id === pageOverride.id ? pageOverride : p));
  const p = pages.find((x) => x.id === pageId);
  const logH = collapsed ? LOG_H.collapsed : LOG_H.open;
  const stageW = w - L.left - L.right, stageH = frameH - TOPBAR_H - TOOLBAR_H - logH - bannerH;
  const scale = Math.min((stageW - 48) / PROJECT.canvas.w, (stageH - 40) / PROJECT.canvas.h);
  const h = p.hotspots.find((x) => x.id === selectedId);
  const left = layout === 'wide' ? pagesPanel(pages, pageId, listHoverId) : pagesRail(pages, pageId, drawer);
  const drawerHtml = layout === 'compact' && drawer ? `<div class="absolute bottom-0 left-0 top-0 z-10 flex shadow-2">${pagesPanel(pages, pageId, listHoverId)}</div>` : '';
  const body = `${left}
      <main class="relative flex min-w-0 flex-1 flex-col" aria-label="Canvas">${drawerHtml}
        ${canvasToolbar({ safe, zoom: Math.round(scale * 100), addDisabled: false, ref })}
        ${canvasStage({ p, scale, selectedId, hoverId, safe, upload, ref })}
      </main>
      <aside aria-label="Properties" class="${layout === 'wide' ? 'w-[320px]' : 'w-[304px]'} flex-none overflow-y-auto border-l bg-surface">${h ? hotspotProps(h, { tested, ref, offline: conn === 'disconnected' }) : pageProps(p, { upload, demo })}</aside>`;
  return shell({ tab: 'Pages', body, collapsed, save, conn, demo, modal, banner: shellBanner, w, h: frameH });
}

/* ---------- Loading: first open of the editor, project not yet received ---------- */
function editorLoading() {
  const rows = [0, 1, 2, 3].map(() => `<li class="flex items-center gap-2 p-1.5">${skeleton('h-4 w-4')}${skeleton('h-9 w-12')}<span class="flex-1 space-y-1.5">${skeleton('h-3 w-24')}${skeleton('h-2.5 w-32')}</span></li>`).join('');
  const body = `<aside aria-label="Pages" class="flex w-[264px] flex-none flex-col border-r bg-surface"><div class="flex h-11 items-center border-b pl-4"><h2 class="text-label-m">Pages</h2></div><ul class="space-y-1 p-2">${rows}</ul></aside>
    <main class="flex min-w-0 flex-1 flex-col" aria-label="Canvas" aria-busy="true"><div class="flex h-11 flex-none items-center gap-2 border-b bg-surface px-3">${button({ variant: 'primary', icon: 'plus', label: 'Add hotspot', disabled: true })}<span class="mx-1 h-5 w-px bg-pressed"></span>${button({ icon: 'crop', label: 'Show safe area', disabled: true })}</div>
      <div class="flex flex-1 items-center justify-center bg-canvas"><div class="flex flex-col items-center gap-3">${skeleton('h-[452px] w-[602px] rounded-none')}<p class="text-body-s text-secondary" role="status">Loading “Demo stand”…</p></div></div></main>
    <aside aria-label="Properties" class="w-[320px] flex-none space-y-4 border-l bg-surface p-4">${skeleton('h-3 w-16')}${skeleton('h-7 w-full')}${skeleton('h-3 w-20')}${skeleton('h-7 w-full')}${skeleton('h-7 w-full')}</aside>`;
  return `<div class="relative flex h-[900px] w-[1440px] flex-col overflow-hidden bg-app text-primary">${topBar({ tab: 'Pages', conn: 'waiting', save: null })}<div class="flex min-h-0 flex-1">${body}</div>${logPanel({ collapsed: true, rows: [] })}</div>`;
}

/* ---------- Below the supported size: notice instead of the editor ---------- */
function editorTooNarrow({ w = 1024, h = 768 } = {}) {
  const rows = PROJECT.stations.map((st) => compactRow({ title: esc(st.name), meta: `<span class="font-mono text-mono-s text-secondary">/play/${st.id}</span>`, trailing: icon('arrow-right', 'text-secondary') })).join('');
  return `<div class="flex items-center justify-center bg-app p-8" style="width:${w}px;height:${h}px">
    <main class="w-[520px] space-y-5 rounded-xl border bg-surface p-8 shadow-1">
      <div class="flex items-center gap-2"><img src="brand/favicon.svg" alt="" class="h-6 w-6"><span class="text-heading-m">Tapcue</span></div>
      <div class="space-y-2"><h1 class="text-heading-xl">The editor needs a wider window</h1>
        <p class="text-body-m text-secondary">The editor is built for windows at least <span class="tabular">1280 × 800</span> px. This one is <span class="tabular">${w} × ${h}</span>. Make the window wider, or open <span class="font-mono text-mono-m text-primary">/edit</span> on a laptop or desktop.</p></div>
      <div class="space-y-2"><p class="text-label-m">Setting up a tablet? Open its station instead:</p><ul class="-mx-2 space-y-0.5">${rows}</ul></div>
      <p class="text-body-s text-muted">The player works at any size; only the editor has a minimum.</p>
    </main></div>`;
}
