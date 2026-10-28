/* Process: low-fidelity wireframes. Built from the .wf kit only (no product components),
   with the real demo content from data.js. */

const N = (i, pos) => `<span class="wf-note" style="${pos}" aria-label="Note ${i}">${i}</span>`;
const wfBtn = (t, primary) => `<span class="wf-btn ${primary ? 'wf-btn-primary' : ''}">${t}</span>`;
const wfField = (label, value, extra = '') => `<div class="min-w-0">${label ? `<span class="wf-label">${label}</span>` : ''}<div class="wf-field ${extra}">${value}</div></div>`;
const wfSeg = (opts, on) => `<div class="inline-flex border" style="border-color:var(--wf-line)">${opts.map((o) => `<span class="px-2.5 py-1 text-[12px] ${o === on ? 'wf-h' : 'wf-muted'}" style="${o === on ? 'background:var(--wf-fill-2)' : ''}">${o}</span>`).join('')}</div>`;
const wfArtBox = (w, h, label, inner = '') => `<div class="wf-art relative" style="width:${w}px;height:${h}px">${label ? `<span class="wf-art-label absolute left-2 top-2">${label}</span>` : ''}${inner}</div>`;
const wfSection = (title, body) => `<div class="space-y-2 border-b px-4 py-3" style="border-color:var(--wf-fill-2)"><p class="wf-small wf-h uppercase tracking-wide wf-muted">${title}</p>${body}</div>`;

/* Hotspots on artwork: dashed = invisible to visitors; one may be selected */
function wfHotspots(pageId, scale, selectedId) {
  return page(pageId).hotspots.map((h) => {
    const sel = h.id === selectedId;
    const st = `left:${Math.round(h.x * scale)}px;top:${Math.round(h.y * scale)}px;width:${Math.round(h.w * scale)}px;height:${Math.round(h.h * scale)}px;${h.shape === 'ellipse' ? 'border-radius:9999px;' : `border-radius:${Math.round((h.r || 0) * scale)}px;`}`;
    const handles = sel ? [[0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50]].map(([x, y]) => `<span class="wf-handle" style="left:${x}%;top:${y}%"></span>`).join('') : '';
    return `<div class="wf-hs ${sel ? 'wf-hs-sel' : ''}" style="${st}">${h.shape === 'ellipse' && !sel ? '' : `<span class="wf-hs-label">${esc(h.name)}</span>`}${handles}</div>`;
  }).join('');
}

/* ---------- Editor shell parts ---------- */
function wfTopBar(tab, topNote) {
  return `<div class="relative flex h-12 flex-none items-stretch gap-6 border-b bg-white px-4" style="border-color:var(--wf-line)">
    <div class="flex items-center gap-2"><span class="wf-h">Tapcue</span><span class="wf-muted">/ ${PROJECT.name}</span></div>
    <div class="flex items-stretch gap-1">${['Pages', 'Targets', 'Stations', 'Settings'].map((t) => `<span class="flex items-center px-3 ${t === tab ? 'wf-tab-active' : 'wf-muted'}">${t}</span>`).join('')}</div>
    <div class="relative ml-auto flex items-center gap-2"><span class="wf-field">○ Connected</span><span class="wf-field">✓ Saved</span>${topNote ? N(topNote, 'left:-26px;top:14px') : ''}</div>
  </div>`;
}
function wfLog(note) {
  const rows = LOG.slice(0, 4).map((e) => `<div class="wf-row grid grid-cols-[120px_80px_130px_150px_1fr] gap-2 px-4 py-1.5 text-[12px]">
    <span class="wf-mono wf-muted">${e.time}</span><span>${e.result === 'sent' ? '✓ Sent' : e.result === 'error' ? '! Error' : '→ Page'}</span>
    <span class="wf-muted">${e.source === 'test' ? '[Test]' : esc(e.source)}</span><span>${esc(e.hotspot)}</span>
    <span class="truncate">${e.result === 'navigation' ? `${e.from} → ${e.navigateTo}` : `${esc(e.target)} <span class="wf-mono">${esc(e.command)}</span>${e.error ? ` · ${e.error}` : ''}`}</span></div>`).join('');
  return `<div class="relative flex h-[176px] flex-none flex-col border-t bg-white" style="border-color:var(--wf-line)">
    ${note ? N(note, 'left:300px;top:8px') : ''}
    <div class="flex h-9 flex-none items-center gap-3 border-b px-4" style="border-color:var(--wf-fill-2)"><span>⌄</span><span class="wf-h">Command log</span><span class="wf-small wf-muted">live from all stations</span><span class="ml-auto wf-muted">Clear</span></div>
    <div class="overflow-hidden">${rows}</div></div>`;
}
const wfShell = (tab, body, { logNote, topNote } = {}) => `<div class="wf flex flex-col overflow-hidden" style="width:1440px;height:900px">${wfTopBar(tab, topNote)}<div class="flex min-h-0 flex-1">${body}</div>${wfLog(logNote)}</div>`;
function wfList(title, items, addLabel) {
  return `<div class="flex w-[264px] flex-none flex-col border-r bg-white" style="border-color:var(--wf-line)">
    <div class="flex h-11 items-center justify-between border-b px-4" style="border-color:var(--wf-fill-2)"><span class="wf-h">${title} <span class="wf-muted">${items.length}</span></span><span class="wf-muted">+ ${addLabel}</span></div>
    <div class="space-y-1 p-2">${items.map(([t, m], i) => `<div class="px-3 py-2 ${i === 0 ? 'wf-fill' : ''}" style="${i === 0 ? 'outline:1.5px solid var(--wf-ink-2)' : ''}"><div class="${i === 0 ? 'wf-h' : ''}">${t}</div><div class="wf-small wf-muted">${m}</div></div>`).join('')}</div></div>`;
}

/* ---------- Pages ---------- */
function wfPages() {
  const scale = 0.38, W = Math.round(2048 * scale), H = Math.round(1536 * scale);
  const thumbs = PROJECT.pages.map((p, i) => `<div class="flex items-center gap-2 p-1.5 ${i === 0 ? 'wf-fill' : ''}" style="${i === 0 ? 'outline:1.5px solid var(--wf-ink-2)' : ''}"><span class="wf-muted">⋮⋮</span><div class="wf-art" style="width:48px;height:36px"></div><div><div class="${i === 0 ? 'wf-h' : ''}">${p.name}</div><div class="wf-small wf-muted">${p.hotspots.length} hotspot${p.hotspots.length === 1 ? '' : 's'} · ${p.bg.type === 'video' ? 'Video' : 'Image'}</div></div></div>`).join('');
  const left = `<div class="relative flex w-[264px] flex-none flex-col border-r bg-white" style="border-color:var(--wf-line)">${N(5, 'right:8px;top:56px')}
    <div class="flex h-11 items-center justify-between border-b px-4" style="border-color:var(--wf-fill-2)"><span class="wf-h">Pages <span class="wf-muted">4</span></span><span class="wf-muted">+ Add page</span></div>
    <div class="space-y-1 p-2">${thumbs}</div></div>`;
  const centre = `<div class="flex min-w-0 flex-1 flex-col">
    <div class="flex h-11 flex-none items-center gap-2 border-b bg-white px-3" style="border-color:var(--wf-line)">${wfBtn('+ Add hotspot', true)}${wfBtn('Show safe area')}<span class="wf-small wf-muted">Reference screen</span><span class="wf-field">16:10 · 1280 × 800 ⌄</span><span class="ml-auto wf-field wf-muted">Fit · 38%</span></div>
    <div class="relative flex flex-1 items-center justify-center" style="background:var(--wf-fill-2)">${N(2, `left:12px;top:12px`)}
      <div class="relative">${wfArtBox(W, H, 'Designer artwork · Home · 2048 × 1536', wfHotspots('home', scale, 'hs-a') + `<div class="absolute bottom-2 left-2">${WF_HS_LEGEND}</div>`)}${N(3, `left:${Math.round(744 * scale) + 8}px;top:${Math.round(500 * scale) + 26}px`)}</div>
    </div></div>`;
  const right = `<div class="relative w-[320px] flex-none overflow-hidden border-l bg-white" style="border-color:var(--wf-line)">${N(4, 'right:10px;top:150px')}
    ${wfSection('Hotspot', wfField('Name', 'Product A card'))}
    ${wfSection('On tap', `${wfField('Go to page', 'Product A ⌄')}${wfField('Send command to', 'Resolume · OSC over UDP ⌄')}<p class="wf-small wf-mono wf-muted">192.168.1.20:7000</p>${wfField('OSC address', '<span class="wf-mono">/composition/columns/2/connect</span>')}
      <div><span class="wf-label">Arguments</span><div class="grid grid-cols-[72px_1fr_20px] gap-2"><div class="wf-field">int ⌄</div><div class="wf-field">1</div><span class="wf-muted">×</span></div></div>
      <div class="flex items-center gap-2">${wfBtn('→ Send test')}<span class="wf-small">✓ Sent at 14:32:05</span></div>`)}
    ${wfSection('Position and size', `<div class="grid grid-cols-4 gap-1.5">${['X 144', 'Y 500', 'W 560', 'H 720'].map((v) => `<div class="wf-field">${v}</div>`).join('')}</div><div class="flex gap-2">${wfSeg(['Rectangle', 'Ellipse'], 'Rectangle')}<div class="wf-field">R 40 px</div></div>`)}
    ${wfSection('Style', `<div class="grid grid-cols-2 gap-2">${wfField('Fill', '⊘ None')}${wfField('Opacity', '100 %')}</div>`)}</div>`;
  return {
    html: wfShell('Pages', left + centre + right, { logNote: 1, topNote: 6 }),
    notes: [
      'The command log stays visible in every tab: the integrator taps on the tablet and watches the result here.',
      'The canvas renders the real page artwork; outlines, handles and labels are editor-only overlays on top.',
      'Invisible hotspots are drawn as dashed outlines so they can be found and selected. Visitors never see them.',
      '"On tap" comes first in the properties: what a button does matters more than its exact position, which is set by dragging.',
      'Pages listed as thumbnails, because integrators recognise pages by their artwork faster than by name.',
      'Connection and save status live in the same spot on every tab: the two things an integrator must be able to trust.',
    ],
  };
}

/* ---------- Targets ---------- */
function wfTargets() {
  const list = wfList('Targets', PROJECT.targets.map((t) => [t.name, `${PROTOCOL_LABEL[t.protocol]} · ${t.protocol === 'http' ? t.baseUrl : `${t.host}:${t.port}`}`]), 'Add target');
  const form = `<div class="relative w-[600px] bg-white" style="border:1px solid var(--wf-line)">
    <div class="flex h-12 items-center justify-between border-b px-5" style="border-color:var(--wf-fill-2)"><span class="wf-h">Resolume</span><span class="wf-muted">Delete target</span></div>
    <div class="space-y-4 p-5">${wfField('Name', 'Resolume')}
      <div class="relative"><span class="wf-label">Protocol</span>${wfSeg(['OSC over UDP', 'UDP', 'HTTP'], 'OSC over UDP')}${N(2, 'left:300px;top:14px')}<p class="wf-small wf-muted mt-1">OSC 1.0 messages over UDP. For media servers and consoles.</p></div>
      <div class="grid grid-cols-[1fr_140px] gap-3">${wfField('Host', '<span class="wf-mono">192.168.1.20</span>')}${wfField('Port', '<span class="wf-mono">7000</span>')}</div>
      <div class="relative border-t pt-4" style="border-color:var(--wf-fill-2)">${N(3, 'right:0;top:12px')}<p class="wf-h">Used by 3 hotspots: Product A, Product B, Product C</p>
        ${['Product A card', 'Product B card', 'Product C card'].map((h) => `<div class="wf-row flex justify-between py-1.5"><span>${h}</span><span class="wf-muted">on Home · Open</span></div>`).join('')}</div></div></div>`;
  const side = `<div class="w-[344px] bg-white" style="border:1px solid var(--wf-line)"><div class="flex h-12 items-center border-b px-5 wf-h" style="border-color:var(--wf-fill-2)">Recent commands</div>
    ${LOG.filter((e) => e.target === 'Resolume').map((e) => `<div class="wf-row px-5 py-2"><span class="wf-mono wf-muted">${e.time}</span> ✓ Sent ${e.source === 'test' ? '[Test]' : e.source}<div class="wf-mono">${e.command} ${e.args}</div></div>`).join('')}</div>`;
  return {
    html: wfShell('Targets', `<div class="relative">${list}${N(4, 'right:10px;top:12px')}</div><div class="flex flex-1 items-start gap-6 p-6">${form}${side}</div>`, { logNote: 1 }),
    notes: [
      'The command log stays in every tab, as on Pages.',
      'Protocol is a segmented control because it changes the fields below: host and port for OSC and UDP, a base URL for HTTP.',
      '"Used by" shows the impact before anyone deletes a target; the delete dialog repeats it.',
      'Targets and Stations share one pattern: list on the left, one form on the right. Learn it once.',
    ],
  };
}

/* ---------- Stations ---------- */
function wfStations() {
  const list = wfList('Stations', PROJECT.stations.map((s) => [s.name, `/play/${s.id} · starts on ${page(s.start).name}`]), 'Add station');
  const form = `<div class="relative w-[600px] bg-white" style="border:1px solid var(--wf-line)">
    <div class="flex h-12 items-center justify-between border-b px-5" style="border-color:var(--wf-fill-2)"><span class="wf-h">Main catalog</span><span class="wf-muted">Delete station</span></div>
    <div class="space-y-4 p-5">${wfField('Name', 'Main catalog')}
      <div class="relative">${wfField('Id', '<span class="wf-muted wf-mono">/play/</span><span class="wf-mono">main</span>')}${N(2, 'right:-10px;top:10px')}<p class="wf-small wf-muted mt-1">Part of the URL. Changing it shows a warning: tablets already set up would stop working.</p></div>
      ${wfField('Start page', 'Home ⌄')}
      <div class="relative"><span class="wf-label">Return to start after idle</span><div class="flex gap-2">${wfSeg(['On', 'Off'], 'On')}<div class="wf-field">90 s</div></div>${N(3, 'left:190px;top:14px')}<p class="wf-small wf-muted mt-1">5–3600 s. Every tap restarts the timer.</p></div></div></div>`;
  const qr = `<div class="relative w-[288px] space-y-3 bg-white p-5" style="border:1px solid var(--wf-line)">${N(1, 'right:-10px;top:-10px')}
    <p class="wf-small wf-h uppercase wf-muted">Station URL</p>
    <div class="mx-auto flex h-[176px] w-[176px] items-center justify-center wf-fill" style="border:1px solid var(--wf-line);background-image:repeating-linear-gradient(0deg,var(--wf-fill-2) 0 8px,transparent 8px 16px),repeating-linear-gradient(90deg,var(--wf-fill-2) 0 8px,transparent 8px 16px)"><span class="wf-art-label">QR code</span></div>
    <p class="wf-mono">${PROJECT.server}/play/main</p><div class="grid grid-cols-2 gap-2">${wfBtn('Copy')}${wfBtn('Open')}</div>
    <p class="wf-small wf-muted">Scan with the tablet camera to open the station.</p></div>`;
  return {
    html: wfShell('Stations', `${list}<div class="flex flex-1 items-start gap-6 p-6">${form}${qr}</div>`),
    notes: [
      'The QR card sits next to the form: the integrator scans it with the tablet while standing at the stand, without leaving this tab.',
      'The id is part of the station URL, so editing it is allowed but warned about.',
      'Idle return is On/Off plus seconds rather than a single number, so "Off" is an explicit choice, not a magic 0.',
    ],
  };
}

/* ---------- Settings ---------- */
function wfSettings() {
  const diag = (mode, label) => `<div class="space-y-1 text-center"><div class="mx-auto flex h-[112px] w-[150px] items-center justify-center" style="${mode === 'fit' ? 'background:var(--wf-ink-2)' : ''}">
      <div class="${mode === 'fit' ? 'wf-art h-[94px] w-[125px]' : 'wf-art h-[112px] w-[150px]'}" style="${mode === 'fill' ? 'outline:2px solid var(--wf-ink);outline-offset:-16px' : ''}"></div></div><p class="wf-small">${label}</p></div>`;
  const canvas = `<div class="relative flex-1 bg-white" style="border:1px solid var(--wf-line)"><div class="flex h-12 items-center border-b px-5 wf-h" style="border-color:var(--wf-fill-2)">Canvas</div>
    <div class="space-y-4 p-5"><div class="flex gap-3">${wfField('Width', '2048 px')}${wfField('Height', '1536 px')}${wfField('Background colour', '■ #000000')}</div>
      <div><span class="wf-label">Scale mode</span>${wfSeg(['Fit', 'Fill'], 'Fill')}<p class="mt-1">Fit: whole page visible, bars where ratios differ. Fill: screen covered, edges may be cropped.</p></div>
      <div class="relative grid grid-cols-4 gap-4 p-4" style="border:1px solid var(--wf-fill-2)">${N(1, 'right:-10px;top:-10px')}${diag('fit', 'Fit · 16:10')}${diag('fit', 'Fit · 16:9')}${diag('fill', 'Fill · 16:10')}${diag('fill', 'Fill · 16:9')}</div></div></div>`;
  const project = `<div class="relative w-[340px] bg-white" style="border:1px solid var(--wf-line)">${N(2, 'right:-10px;top:-10px')}<div class="flex h-12 items-center border-b px-5 wf-h" style="border-color:var(--wf-fill-2)">Project</div>
    <div class="space-y-4 p-5"><div><p class="wf-h">Export .zip</p><p class="wf-muted">Pages, hotspots, targets, stations and background files in one file.</p><div class="mt-2">${wfBtn('Export .zip')}</div></div>
      <div class="border-t pt-4" style="border-color:var(--wf-fill-2)"><p class="wf-h">Import .zip</p><p class="wf-muted">Replaces the whole project. Asks first.</p><div class="mt-2">${wfBtn('Import .zip')}</div></div></div></div>`;
  return {
    html: wfShell('Settings', `<div class="mx-auto flex w-full max-w-[1200px] items-start gap-6 p-6">${canvas}${project}</div>`),
    notes: [
      'Fit and Fill are explained with four small pictures (two screens × two modes) rather than a paragraph: cropping is easier to see than to read.',
      'Import replaces everything, so it is a separate card with its own confirmation, away from everyday settings.',
    ],
  };
}

/* ---------- Player ---------- */
const WF_HS_LEGEND = '<span class="wf-art-label">Dashed outlines = hotspot areas, shown in this document only. Visitors never see them.</span>';
function wfPlayer(indicator) {
  const inner = wfHotspots('home', 0.5) + `<div class="absolute right-2 top-2">${WF_HS_LEGEND}</div>` + (indicator ? `<div class="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-white" style="background:var(--wf-ink)">◌ Reconnecting…</div>${N(1, 'right:150px;bottom:12px')}` : N(1, 'left:12px;bottom:12px') + N(2, `left:${Math.round(144 * 0.5) - 10}px;top:${Math.round(500 * 0.5) - 10}px`));
  return {
    html: `<div class="wf" style="width:1024px;height:768px">${wfArtBox(1024, 768, 'Designer artwork · Home · scaled from 2048 × 1536', inner)}</div>`,
    notes: indicator
      ? ['The only Tapcue UI a visitor can ever see: small, in a corner, and only while the network is down. Taps made meanwhile are kept for 5 s and sent on reconnect. (The dashed hotspot outlines are never visible.)']
      : ['The player shows only the designer\'s artwork, full screen. No Tapcue branding, no controls.', 'Dashed outlines mark hotspot areas for this document only. Visitors never see them.'],
  };
}
function wfNotFound() {
  return {
    html: `<div class="wf flex items-center justify-center" style="width:1024px;height:768px"><div class="relative w-[520px] space-y-4 bg-white p-8" style="border:1px solid var(--wf-line)">${N(1, 'right:-10px;top:-10px')}
      <p class="wf-h">Tapcue</p><p class="text-[24px] wf-h">Station not found</p>
      <p>This server has no station with the id <span class="wf-mono">mian</span>. Check the address, or open one of these stations:</p>
      ${PROJECT.stations.map((s) => `<div class="wf-row flex justify-between py-2"><span>${s.name}</span><span class="wf-mono wf-muted">/play/${s.id} →</span></div>`).join('')}
      <p class="wf-small wf-muted">Stations are set up in the editor at ${PROJECT.server}/edit.</p></div></div>`,
    notes: ['Meant for the integrator during setup, so it may show Tapcue UI: the unknown id and links to the stations that do exist.'],
  };
}

/* ---------- Demo receiver ---------- */
function wfReceiver() {
  const tiles = [['Screen 1', 'product-a', true], ['Screen 2', 'about-us'], ['Screen 3', 'call-staff']].map(([n, c, fresh], i) => `<div class="relative flex-1 space-y-2 bg-white p-3" style="border:${fresh ? '2px solid var(--wf-ink)' : '1px solid var(--wf-line)'}">${i === 0 ? N(1, 'right:-10px;top:-10px') : ''}
    <div class="flex justify-between"><span class="wf-h">${n}</span><span class="wf-small ${fresh ? 'wf-h' : 'wf-muted'}">${fresh ? 'Just changed' : 'Playing'}</span></div>
    <div class="flex h-[180px] items-center justify-center text-[22px] text-white" style="background:var(--wf-ink-2)"><span class="wf-mono" style="font-size:22px">${c}</span></div>
    <p class="wf-small wf-muted">Since 14:32 · Main catalog</p></div>`).join('');
  const rows = [['14:32:41.207', 'Main catalog', 'Play demo', '/demo/screen-1/product-a', '—'], ['14:32:18.950', 'Main catalog', 'About', '/demo/screen-2/about-us', '—'], ['14:30:05.334', 'Small screen', 'Call our team', '/demo/screen-3/call-staff', '{ "stand": "B12" }']]
    .map((r, i) => `<div class="wf-row grid grid-cols-[130px_120px_120px_60px_1fr_160px_70px] gap-2 px-5 py-2 ${i === 0 ? 'wf-fill' : ''}"><span class="wf-mono wf-muted">${r[0]}</span><span>${r[1]}</span><span>${r[2]}</span><span class="wf-mono">POST</span><span class="wf-mono">${r[3]}</span><span class="wf-mono wf-muted">${r[4]}</span><span>✓ 200</span></div>`).join('');
  return {
    html: `<div class="wf flex flex-col" style="width:1280px;height:800px">
      <div class="flex h-16 items-center gap-4 border-b bg-white px-6" style="border-color:var(--wf-line)"><div><p class="text-[18px] wf-h">Demo receiver</p><p class="wf-small wf-muted">Listening on <span class="wf-mono">http://localhost:4000/demo/&lt;screen&gt;/&lt;content&gt;</span></p></div><div class="ml-auto flex gap-2"><span class="wf-field">○ Receiving · 4 requests</span>${wfBtn('Open player')}</div></div>
      <div class="space-y-5 p-6"><p class="wf-h">Screens</p><div class="flex gap-4">${tiles}</div>
        <div class="relative bg-white" style="border:1px solid var(--wf-line)">${N(2, 'right:-10px;top:-10px')}<div class="flex h-10 items-center border-b px-5 wf-h" style="border-color:var(--wf-fill-2)">Requests, newest first</div>
          <div class="wf-row grid grid-cols-[130px_120px_120px_60px_1fr_160px_70px] gap-2 px-5 py-1.5 wf-small wf-muted uppercase"><span>Time</span><span>Station</span><span>Hotspot</span><span>Method</span><span>Path</span><span>Body</span><span>Status</span></div>${rows}</div></div></div>`,
    notes: [
      'One tile per screen name received so far, showing what that screen would now play. The newest change is marked so the tap → command flow reads in a second.',
      'Every request is logged with its path, body and status, so a reviewer can see exactly what the server sent.',
    ],
  };
}
