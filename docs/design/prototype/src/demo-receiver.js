/* Demo receiver at 1280 x 800: what a tap sends, as it arrives */
const RX = [
  { time: '14:32:41.207', station: 'Main catalog', hotspot: 'Play demo', method: 'POST', path: '/demo/screen-1/product-a', body: '', status: 200 },
  { time: '14:32:18.950', station: 'Main catalog', hotspot: 'About', method: 'POST', path: '/demo/screen-2/about-us', body: '', status: 200 },
  { time: '14:30:05.334', station: 'Small screen', hotspot: 'Call our team', method: 'POST', path: '/demo/screen-3/call-staff', body: '{ "stand": "B12" }', status: 200 },
  { time: '14:29:47.812', station: 'Main catalog', hotspot: 'Play demo', method: 'POST', path: '/demo/screen-1/product-b', body: '', status: 200 },
];
function rxRow(r, fresh) {
  return `<tr class="${fresh ? 'bg-accent-subtle' : 'hover:bg-hover'}">
    <td class="whitespace-nowrap py-2 pl-5 pr-2 font-mono text-mono-s text-muted tabular">${r.time}</td>
    <td class="px-2 py-2 text-body-s text-secondary">${esc(r.station)}</td>
    <td class="px-2 py-2 text-body-s">${esc(r.hotspot)}</td>
    <td class="px-2 py-2 font-mono text-mono-s">${r.method}</td>
    <td class="px-2 py-2 font-mono text-mono-s">${r.path.replace(/^(\/demo\/)([^/]+)\/(.+)$/, '<span class="text-muted">$1</span>$2/<strong class="font-medium">$3</strong>')}</td>
    <td class="max-w-[200px] truncate px-2 py-2 font-mono text-mono-s ${r.body ? 'text-secondary' : 'text-muted'}">${r.body ? esc(r.body) : '—'}</td>
    <td class="py-2 pl-2 pr-5"><span class="inline-flex items-center gap-1 text-label-s text-success-fg">${icon('check', 'h-3.5 w-3.5')}${r.status} OK</span>${fresh ? ' <span class="ml-1 inline-flex h-5 items-center rounded-sm bg-accent px-1.5 text-label-s text-on-accent">New</span>' : ''}</td></tr>`;
}
function flowStrip() {
  const step = (n, t, d) => `<li class="flex min-w-0 flex-1 items-start gap-3"><span class="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent text-label-s text-on-accent">${n}</span><div class="min-w-0"><p class="text-label-m">${t}</p><p class="text-body-s text-secondary">${d}</p></div></li>`;
  return `<ol class="flex items-start gap-3" aria-label="How it works">
    ${step(1, 'A visitor taps', 'on a tablet running a station, e.g. /play/main')}${icon('arrow-right', 'mt-1 text-muted')}
    ${step(2, 'Tapcue sends the command', 'as HTTP to its target, here this page')}${icon('arrow-right', 'mt-1 text-muted')}
    ${step(3, 'The screen updates', `<span class="font-mono text-mono-s">/demo/&lt;screen&gt;/&lt;content&gt;</span> sets that tile`)}</ol>`;
}
function receiver({ state }) {
  const waiting = state === 'waiting', fresh = state === 'fresh';
  const rows = fresh ? RX : RX.slice(1);
  const tiles = [
    { name: 'Screen 1', content: fresh ? 'product-a' : 'product-b', since: fresh ? '14:32:41' : '14:29:47', source: 'Main catalog · Play demo', fresh },
    { name: 'Screen 2', content: 'about-us', since: '14:32:18', source: 'Main catalog · About' },
    { name: 'Screen 3', content: 'call-staff', since: '14:30:05', source: 'Small screen · Call our team' },
  ];
  const status = waiting
    ? badge('waiting', 'Waiting for the first command')
    : badge('connected', `Receiving · ${rows.length} requests`);
  const header = `<header class="flex h-16 flex-none items-center gap-4 border-b bg-surface px-6">
    <span class="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-subtle)]" aria-hidden="true"></span>
    <div class="min-w-0"><h1 class="text-heading-l">Demo receiver</h1><p class="text-body-s text-secondary">Listening on <span class="font-mono text-mono-s text-primary">http://localhost:4000/demo/&lt;screen&gt;/&lt;content&gt;</span></p></div>
    <div class="ml-auto flex items-center gap-2">${status}${button({ icon: 'external', label: 'Open player' })}${waiting ? '' : button({ variant: 'ghost', label: 'Clear' })}</div></header>`;
  const body = waiting
    ? `<div class="flex flex-1 items-center justify-center p-8"><div class="w-[720px] space-y-6 rounded-xl border bg-surface p-8 shadow-1">
        <div class="space-y-2"><h2 class="text-heading-xl">Tap something to see it arrive</h2><p class="text-body-m text-secondary">This page stands in for the screens on a real stand. Each tap on a tablet sends an HTTP request here, and the screen it names shows what it would play.</p></div>
        <div class="space-y-2 rounded-lg border bg-subtle p-4"><p class="text-label-m">Open the player in another tab, then tap "Play demo" or "About"</p>
          <div class="flex items-center gap-2"><div class="min-w-0 flex-1">${textField({ id: 'rx-url', ariaLabel: 'Player URL', value: 'http://localhost:4000/play/main', mono: true, readonly: true })}</div>${button({ icon: 'copy', label: 'Copy' })}${button({ variant: 'primary', icon: 'external', label: 'Open' })}</div></div>
        <div class="border-t pt-5">${flowStrip()}</div></div></div>`
    : `<div class="flex min-h-0 flex-1 flex-col gap-5 p-6">
        <div class="flex items-center justify-between"><h2 class="text-heading-m">Screens</h2><p class="text-body-s text-muted">A tile appears for every screen name received so far.</p></div>
        <div class="grid grid-cols-3 gap-4">${tiles.map(screenTile).join('')}</div>
        <section class="flex min-h-0 flex-1 flex-col rounded-lg border bg-surface" aria-label="Requests">
          <div class="flex h-10 flex-none items-center justify-between border-b px-5"><h2 class="text-label-m">Requests <span class="text-body-s text-muted">newest first</span></h2><span class="text-body-s text-muted">Station and hotspot come from the X-Tapcue-Station and X-Tapcue-Hotspot headers</span></div>
          <div class="min-h-0 flex-1 overflow-y-auto"><table class="w-full text-left"><thead class="sticky top-0 bg-subtle"><tr class="text-overline uppercase text-muted">
            <th scope="col" class="py-1.5 pl-5 pr-2 font-semibold">Time</th><th scope="col" class="px-2 py-1.5 font-semibold">Station</th><th scope="col" class="px-2 py-1.5 font-semibold">Hotspot</th><th scope="col" class="px-2 py-1.5 font-semibold">Method</th><th scope="col" class="px-2 py-1.5 font-semibold">Path</th><th scope="col" class="px-2 py-1.5 font-semibold">Body</th><th scope="col" class="py-1.5 pl-2 pr-5 font-semibold">Status</th></tr></thead>
            <tbody class="divide-y">${rows.map((r, i) => rxRow(r, fresh && i === 0)).join('')}</tbody></table></div>
        </section></div>`;
  return `<div class="flex h-[800px] w-[1280px] flex-col overflow-hidden bg-app text-primary">${header}${body}</div>`;
}
