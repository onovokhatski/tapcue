/* Process: screen map. Low-fidelity, uses the .wf kit. */
const APPS = [
  { name: 'Editor', who: 'Integrator', device: 'Desktop browser, 1280 × 800 and up', route: '/edit', screens: [
    { name: 'Editor shell', route: '/edit/*', purpose: 'The frame every editor tab shares.', has: ['Top bar: product, project name, tabs', 'Connection and save status', 'Command log panel at the bottom'], states: ['Loading', 'Saving', 'Saved', 'Save error', 'Disconnected', 'Demo mode', 'Too narrow (< 1280 px)'] },
    { name: 'Pages', route: '/edit/pages', purpose: 'Turn artwork into pages with hotspots.', has: ['Page list with thumbnails (add, rename, reorder, delete)', 'Canvas: real page + hotspot overlays, safe area', 'Properties: hotspot (name, on tap, geometry, style) or page (background upload)'], states: ['Empty page (no background)', 'Uploading', 'Upload error', 'Hotspot selected', 'Cropped hotspot warning', 'Disabled in demo mode'] },
    { name: 'Targets', route: '/edit/targets', purpose: 'Where commands go: media servers, projectors, HTTP.', has: ['Target list', 'Form: name, protocol, host + port or base URL', '"Used by" hotspots', 'Recent commands to this target'], states: ['Empty', 'Invalid host / port', 'Delete confirmation'] },
    { name: 'Stations', route: '/edit/stations', purpose: 'One entry point per tablet.', has: ['Station list', 'Form: name, id, start page, idle timeout', 'QR card with the station URL'], states: ['Empty', 'Id changed (warning)', 'URL copied', 'Invalid id (QR disabled)'] },
    { name: 'Settings', route: '/edit/settings', purpose: 'Canvas size and scale mode; project files.', has: ['Width, height, background colour', 'Fit / Fill with diagram', 'Export .zip, Import .zip'], states: ['Import confirmation', 'Import error', 'Demo mode (import off)'] },
    { name: 'Command log', route: 'panel in every tab', purpose: 'See what every tap and test send did, live.', has: ['Time, result, station or Test, hotspot, command', 'Collapsed to one line, or expanded'], states: ['Empty', 'Sent', 'Error (with reason)', 'Navigation only', 'Collapsed'] },
  ] },
  { name: 'Player', who: 'Visitor', device: 'Tablet, full screen (iPad 1024 × 768)', route: '/play/:station', screens: [
    { name: 'Player', route: '/play/:station', purpose: 'Show the artwork and turn taps into commands.', has: ['Current page artwork, full screen', 'Invisible hotspots with press effects', 'Fade between pages', 'Idle return to the start page'], states: ['Loading', 'Reconnecting (taps kept 5 s)'] },
    { name: 'Station not found', route: '/play/:unknown', purpose: 'Help the integrator fix a wrong URL during setup.', has: ['The unknown id', 'Links to the stations that exist'], states: ['Shown instead of the player'] },
  ] },
  { name: 'Demo receiver', who: 'Reviewer', device: 'Any browser, next to the player', route: '/demo', screens: [
    { name: 'Demo receiver', route: '/demo', purpose: 'Stand in for the stand\'s screens so the flow can be tried without hardware.', has: ['Listening address', 'A tile per screen with what it plays', 'Log of received requests'], states: ['Waiting for the first command', 'Receiving', 'Just changed'] },
  ] },
];
const FLOWS = [
  ['/', 'redirects to', '/edit'],
  ['Stations: QR code or URL', '→', 'Player on the tablet'],
  ['Editor save', '→ server →', 'every open Player updates live'],
  ['Player tap', '→ server →', 'target (media server or Demo receiver)'],
  ['Editor "Send test"', '→ server →', 'target, marked Test in the log'],
  ['Server', '→', 'Command log in the editor (live)'],
  ['Unknown station id', '→', 'Station not found'],
];
function screenCard(s) {
  return `<article class="space-y-2 bg-white p-4" style="border:1px solid var(--wf-line)">
    <div class="flex items-baseline justify-between gap-2"><h3 class="wf-h text-[15px]">${s.name}</h3><span class="wf-mono wf-muted">${s.route}</span></div>
    <p>${s.purpose}</p>
    <div><p class="wf-small wf-h uppercase wf-muted">Contains</p><ul class="list-disc pl-4">${s.has.map((h) => `<li>${h}</li>`).join('')}</ul></div>
    <div><p class="wf-small wf-h uppercase wf-muted">States to show</p><div class="mt-1 flex flex-wrap gap-1">${s.states.map((x) => `<span class="px-1.5 py-0.5 wf-small" style="border:1px solid var(--wf-line)">${x}</span>`).join('')}</div></div>
  </article>`;
}
function screenMap() {
  const col = (a) => `<section class="min-w-0 space-y-3" aria-label="${a.name}"><header class="space-y-0.5 pb-2" style="border-bottom:2px solid var(--wf-ink)">
      <h2 class="wf-h text-[18px]">${a.name}</h2><p class="wf-muted">${a.who} · ${a.device}</p><p class="wf-mono">${a.route}</p></header>${a.screens.map(screenCard).join('')}</section>`;
  const flows = `<section class="min-w-0 space-y-3" aria-label="Connections"><header class="space-y-0.5 pb-2" style="border-bottom:2px solid var(--wf-ink)">
      <h2 class="wf-h text-[18px]">Connections</h2><p class="wf-muted">How the apps reach each other</p><p class="wf-mono">via the Tapcue server</p></header>
    <ol class="space-y-2">${FLOWS.map(([a, arrow, b], i) => `<li class="bg-white p-3" style="border:1px solid var(--wf-line)"><span class="wf-small wf-muted">${i + 1}</span><p><span class="wf-h">${a}</span> <span class="wf-muted">${arrow}</span> ${b}</p></li>`).join('')}</ol>
    <p class="wf-small wf-muted">All show logic stays on the media server. Tapcue only shows the interface and delivers commands, in the stand's local network.</p></section>`;
  return `<div class="wf grid grid-cols-4 gap-6 p-6" style="width:1440px">${APPS.map(col).join('')}${flows}</div>`;
}
