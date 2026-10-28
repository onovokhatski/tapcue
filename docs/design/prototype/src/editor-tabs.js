/* Targets, Stations and Settings tabs, composed from components.js */

const mono = (t) => `<span class="font-mono text-mono-s">${esc(t)}</span>`;
const addr = (t) => (t.protocol === 'http' ? t.baseUrl : `${t.host}:${t.port}`);
const PROTOCOL_HELP = {
  'OSC over UDP': 'OSC 1.0 messages over UDP. For media servers and consoles such as Resolume, QLab or MagicQ.',
  UDP: 'Plain text over UDP, for projectors and controllers that accept simple strings.',
  HTTP: 'An HTTP request to a URL, for web hooks and devices with an HTTP API. Times out after 2 s.',
};
function usedBy(targetId) {
  const out = [];
  PROJECT.pages.forEach((p) => p.hotspots.forEach((h) => { if (h.target === targetId) out.push({ page: p.name, hotspot: h.name }); }));
  return out;
}
const mainScroll = (inner) => `<main class="min-w-0 flex-1 overflow-y-auto">${inner}</main>`;

/* ================= Targets ================= */
function targetForm(t, { hostError, portError } = {}) {
  const proto = PROTOCOL_LABEL[t.protocol];
  const fields = t.protocol === 'http'
    ? textField({ id: 't-url', label: 'Base URL', value: t.baseUrl, mono: true, helper: 'Hotspot paths are added to this, e.g. /demo/screen-1/product-a.' })
    : `<div class="grid grid-cols-[minmax(0,1fr)_140px] gap-3">
        ${textField({ id: 't-host', label: 'Host', value: hostError ? '192.168.1.400' : t.host, mono: true, error: hostError, helper: 'IP address or hostname on the stand network.' })}
        ${textField({ id: 't-port', label: 'Port', value: portError ? '70000' : t.port, mono: true, error: portError, helper: '1–65535' })}</div>`;
  const uses = usedBy(t.id);
  const usedList = uses.length
    ? `<div class="space-y-2"><h3 class="text-label-m">Used by ${uses.length} hotspot${uses.length === 1 ? '' : 's'}: ${uses.map((u) => esc(u.hotspot.replace(' card', ''))).join(', ')}</h3>
       <ul class="-mx-2 space-y-0.5">${uses.map((u) => compactRow({ title: esc(u.hotspot), meta: `on ${esc(u.page)}`, trailing: `<span class="flex-none text-label-s text-link">Open</span>` })).join('')}</ul></div>`
    : `<p class="text-body-m text-muted">No hotspot sends to this target yet.</p>`;
  const invalid = hostError || portError;
  return formCard({
    title: esc(t.name),
    action: button({ variant: 'ghost', size: 's', icon: 'trash', label: 'Delete target' }),
    body: `${textField({ id: 't-name', label: 'Name', value: t.name })}
      <div class="space-y-1.5"><p class="text-label-s text-secondary">Protocol</p>${segmented({ label: 'Protocol', options: ['OSC over UDP', 'UDP', 'HTTP'], value: proto })}<p class="text-body-s text-muted">${PROTOCOL_HELP[proto]}</p></div>
      ${fields}
      ${invalid ? `<p class="flex items-start gap-1.5 text-body-s text-secondary">${icon('alert', 'mt-px h-3.5 w-3.5 text-danger-fg')}<span>2 fields need fixing. Hotspots keep sending to the last valid address, ${mono('192.168.1.20:7000')}, until then.</span></p>` : `<p class="text-body-s text-muted">Changes save automatically.</p>`}
      <div class="border-t pt-5">${usedList}</div>`,
  });
}
function recentCard(name) {
  const rows = LOG.filter((e) => e.target === name);
  return `<section class="rounded-lg border bg-surface" aria-label="Recent commands"><div class="flex h-12 items-center border-b px-5"><h2 class="text-heading-m">Recent commands</h2></div>
    ${rows.length ? `<ul class="divide-y">${rows.map(logRowCompact).join('')}</ul>`
      : `<p class="px-5 py-6 text-body-s text-muted">Nothing sent to this target yet.</p>`}</section>`;
}
function targetsScreen({ selected = 'resolume', empty, hostError, portError, modal, w, h, collapsed } = {}) {
  const targets = empty ? [] : PROJECT.targets;
  const items = targets.map((t) => ({ title: t.name, meta: `${PROTOCOL_LABEL[t.protocol]} · ${mono(addr(t))}`, selected: t.id === selected, warn: t.id === selected && hostError }));
  const t = target(selected);
  const main = empty
    ? `<main class="flex min-w-0 flex-1 items-center justify-center p-6">${emptyState({ icon: 'arrow-right', title: 'Add your first target', body: 'A target is a device that receives commands: a media server, a projector, a lighting console. Hotspots send their commands to targets.', action: button({ variant: 'primary', icon: 'plus', label: 'Add target' }) })}</main>`
    : mainScroll(`<div class="grid max-w-[1080px] grid-cols-[minmax(0,600px)_minmax(0,1fr)] items-start gap-6 p-6">${targetForm(t, { hostError, portError })}${recentCard(t.name)}</div>`);
  return shell({ tab: 'Targets', body: listPanel({ title: 'Targets', items, addLabel: 'Add target', empty: 'No targets yet.' }) + main, logRows: empty ? [] : LOG, modal, w, h, collapsed });
}

/* ================= Stations ================= */
function stationsScreen({ selected = 'main', empty, editingId, copied } = {}) {
  const stations = empty ? [] : PROJECT.stations;
  const s = PROJECT.stations.find((x) => x.id === selected);
  const id = editingId || s.id;
  const url = `${PROJECT.server}/play/${id}`;
  const items = stations.map((x) => ({ title: x.name, meta: `${mono(`/play/${x.id === selected ? id : x.id}`)} · starts on ${esc(page(x.start).name)}`, selected: x.id === selected }));
  const idField = editingId
    ? `<div class="min-w-0 space-y-1"><label for="st-id" class="block text-label-s text-secondary">Id</label>
        <div class="field-focus flex h-8 items-center rounded border bg-surface"><span class="select-none border-r border-default px-2 font-mono text-mono-s text-muted">/play/</span><input id="st-id" aria-describedby="st-id-msg" class="h-full w-full min-w-0 bg-transparent px-2 font-mono text-mono-m outline-none" value="${esc(id)}"></div>
        <p id="st-id-msg" class="text-body-s text-muted">Lowercase letters, digits and hyphens.</p></div>
       ${banner({ tone: 'warning', title: 'Tablets using the old URL will stop working', body: `Changing the id from ${mono('main')} changes the station URL. Scan the new QR code on every tablet already set up.` })}`
    : textField({ id: 'st-id', label: 'Id', value: id, mono: true, prefix: '/play/', helper: 'Lowercase letters, digits and hyphens. Part of the URL.' });
  const form = formCard({
    title: esc(s.name),
    action: button({ variant: 'ghost', size: 's', icon: 'trash', label: 'Delete station' }),
    body: `${textField({ id: 'st-name', label: 'Name', value: s.name, helper: 'Shown in the command log.' })}
      ${idField}
      ${select({ id: 'st-start', label: 'Start page', value: page(s.start).name, helper: 'Where the tablet opens and where it returns after idle.' })}
      <div class="space-y-1.5"><p class="text-label-s text-secondary">Return to start after idle</p>
        <div class="flex items-center gap-2">${segmented({ label: 'Idle return', options: ['On', 'Off'], value: 'On' })}<div class="w-[112px]">${numberField({ value: s.idle, suffix: 's', ariaLabel: 'Idle seconds' })}</div></div>
        <p class="text-body-s text-muted">5–3600 s. Every tap restarts the timer.</p></div>
      <p class="text-body-s text-muted">Changes save automatically.</p>`,
  });
  const side = `<div class="space-y-3">${qrCard({ url, qr: QR[id] || QR.main, copied })}
    <p class="w-[288px] text-body-s text-secondary">Scan with the tablet camera to open the station. For a kiosk, add it to the Home Screen and turn on Guided Access.</p></div>`;
  const main = empty
    ? `<main class="flex min-w-0 flex-1 items-center justify-center p-6">${emptyState({ icon: 'external', title: 'Add a station for each tablet', body: 'A station is an entry point with its own start page and idle timeout. Each tablet opens its station URL, shown as a QR code.', action: button({ variant: 'primary', icon: 'plus', label: 'Add station' }) })}</main>`
    : mainScroll(`<div class="flex max-w-[1080px] items-start gap-6 p-6"><div class="min-w-0 max-w-[600px] flex-1">${form}</div>${side}</div>`);
  return shell({ tab: 'Stations', body: listPanel({ title: 'Stations', items, addLabel: 'Add station', empty: 'No stations yet.' }) + main, save: editingId ? 'saving' : 'saved' });
}

/* ================= Settings ================= */
function settingsScreen({ modal, importError, demo } = {}) {
  const c = PROJECT.canvas;
  const canvas = formCard({
    title: 'Canvas',
    body: `<div class="flex flex-wrap items-end gap-3">
        <div class="w-[132px] space-y-1"><p class="text-label-s text-secondary">Width</p>${numberField({ value: c.w, suffix: 'px', ariaLabel: 'Width' })}</div>
        <div class="w-[132px] space-y-1"><p class="text-label-s text-secondary">Height</p>${numberField({ value: c.h, suffix: 'px', ariaLabel: 'Height' })}</div>
        <div class="w-[200px] space-y-1"><p class="text-label-s text-secondary">Background colour</p>${colorField({ value: c.bg.toUpperCase(), ariaLabel: 'background colour' })}</div>
      </div>
      <p class="text-body-s text-muted">Every page is drawn at this size. The background colour shows behind artwork and in the bars of Fit mode.</p>
      <div class="space-y-2 border-t pt-5"><p class="text-label-s text-secondary">Scale mode</p>${segmented({ label: 'Scale mode', options: ['Fit', 'Fill'], value: 'Fill' })}
        <dl class="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 gap-y-1 text-body-m"><dt class="font-medium">Fit</dt><dd class="text-secondary">The whole page is visible. Bars fill the space where aspect ratios differ.</dd>
        <dt class="font-medium">Fill</dt><dd class="text-secondary">The screen is covered. Edges of the page may be cropped; check hotspots with "Show safe area" on the Pages tab.</dd></dl></div>
      <div class="rounded-lg border bg-subtle p-4">
        <div class="grid grid-cols-4 gap-4">
          <p class="col-span-2 border-b pb-1 text-center text-label-m">Fit</p><p class="col-span-2 border-b pb-1 text-center text-label-m">Fill</p>
          ${scaleDiagram({ mode: 'fit', ref: '16:10' })}${scaleDiagram({ mode: 'fit', ref: '16:9' })}${scaleDiagram({ mode: 'fill', ref: '16:10' })}${scaleDiagram({ mode: 'fill', ref: '16:9' })}
        </div>
        <p class="mt-3 text-body-s text-secondary">The 2048 × 1536 page is 4:3, like the iPad (1024 × 768), so on the iPad both modes show the whole page.</p>
      </div>`,
  });
  const project = formCard({
    title: 'Project',
    body: `${importError ? banner({ tone: 'error', title: 'Import failed', body: `${mono('stand-backup.zip')} is not a Tapcue project: it has no project.json. Choose a file made with Export .zip. The current project is unchanged.`, dismissible: true }) : ''}
      <div class="space-y-3"><div><h3 class="text-label-m">Export .zip</h3><p class="text-body-m text-secondary">Pages, hotspots, targets, stations and every background file in one file. Use it as a backup or to move the stand to another server.</p></div>${button({ icon: 'download', label: 'Export .zip' })}</div>
      <div class="space-y-3 border-t pt-5"><div><h3 class="text-label-m ${demo ? 'text-disabled' : ''}">Import .zip</h3><p class="text-body-m text-secondary">Replaces the whole project with the one in the file. You will be asked to confirm.</p>${demo ? `<p class="mt-1 text-body-s text-muted">Not available in demo mode.</p>` : ''}</div>${button({ icon: 'upload', label: 'Import .zip', disabled: demo })}</div>`,
  });
  const info = demo ? banner({ tone: 'info', title: 'Demo mode', body: 'Changes stay in this browser tab and are lost when you close it. Saving, uploads and import are turned off; Export still works.' }) : '';
  const body = mainScroll(`<div class="mx-auto max-w-[1200px] space-y-6 p-6">${info}<div class="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6">${canvas}${project}</div></div>`);
  return shell({ tab: 'Settings', body, demo, modal, collapsed: true });
}
const IMPORT_DIALOG = dialog({ title: 'Replace the current project?', body: `<p>${mono('demo-stand-1027.zip')} has 4 pages, 3 targets and 2 stations. Everything in "Demo stand" will be replaced, including background files.</p><p>Export first if you may need the current version.</p>`, confirmLabel: 'Replace project' });
const DELETE_TARGET_DIALOG = dialog({ tone: 'danger', title: 'Delete target “Resolume”?', body: '<p>3 hotspots send commands to it: Product A, Product B and Product C cards. Their commands will be cleared. Page links on those hotspots stay.</p>', confirmLabel: 'Delete target', confirmIcon: 'trash' });
