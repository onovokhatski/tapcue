/* Visitor-facing player at 1024 x 768 (iPad landscape). Only artwork; Tapcue adds nothing visible
   except the connection indicator. Annotation layers below are for handoff only. */
const PW = 1024, PH = 768, PS = PW / PROJECT.canvas.w; // 0.5

const playerFrame = (inner) => `<div class="relative h-[768px] w-[1024px] overflow-hidden" style="background:${PROJECT.canvas.bg}">${inner}</div>`;
const art = (id, extra = '') => `<img src="${page(id).bg.src}" alt="" class="absolute inset-0 h-full w-full" ${extra}>`;
const ps = (v) => Math.round(v * PS);

/* Connection indicator: the only Tapcue UI a visitor can see */
const connectionIndicator = () => `<div role="status" class="tc-indicator"><span class="spinner h-3 w-3" aria-hidden="true"></span>Reconnecting…</div>`;
const loadingIndicator = () => `<div role="status" class="tc-indicator"><span class="spinner h-3 w-3" aria-hidden="true"></span>Loading…</div>`;

/* Handoff annotation marker: number badge + two-tone outline (never rendered in the player) */
function annotationMarker(h, n) {
  return `<div class="absolute" style="left:${ps(h.x)}px;top:${ps(h.y)}px;width:${ps(h.w)}px;height:${ps(h.h)}px">
    <svg class="hs" data-state="hover" style="inset:0" width="100%" height="100%" aria-hidden="true">${h.shape === 'ellipse' ? '<ellipse class="hs-fill" cx="50%" cy="50%" rx="50%" ry="50%"/><ellipse class="hs-under" cx="50%" cy="50%" rx="50%" ry="50%"/><ellipse class="hs-line" cx="50%" cy="50%" rx="50%" ry="50%"/>' : `<rect class="hs-fill" width="100%" height="100%" rx="${ps(h.r || 0)}"/><rect class="hs-under" width="100%" height="100%" rx="${ps(h.r || 0)}"/><rect class="hs-line" width="100%" height="100%" rx="${ps(h.r || 0)}"/>`}</svg>
    <span class="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-overlay-selected text-label-s text-on-accent ring-2 ring-[color:var(--color-overlay-dark)]">${n}</span></div>`;
}
function onTapText(h) {
  const parts = [];
  if (h.goto) parts.push(`Go to <strong class="font-medium text-primary">${esc(page(h.goto).name)}</strong>`);
  if (h.target) {
    const t = target(h.target);
    const cmd = h.osc ? `${h.osc.address} ${h.osc.args.map((a) => `${a.type[0]} ${a.value}`).join(' ')}` : h.http ? `${h.http.method} ${h.http.path}` : h.udp.text;
    parts.push(`Send to <strong class="font-medium text-primary">${esc(t.name)}</strong> <span class="font-mono text-mono-s">${esc(cmd)}</span>`);
  }
  return parts.join('<br>');
}
function annotatedHome() {
  const p = page('home');
  const legend = p.hotspots.map((h, i) => `<li class="grid grid-cols-[24px_minmax(0,1fr)] gap-3 border-t px-4 py-3">
      <span class="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-label-s text-on-accent">${i + 1}</span>
      <div class="min-w-0 space-y-0.5"><p class="text-label-m">${esc(h.name)} <span class="text-body-s text-muted">· ${h.shape === 'ellipse' ? 'Ellipse' : 'Rectangle'}, invisible</span></p>
        <p class="text-body-s text-secondary">${onTapText(h)}</p>
        <p class="font-mono text-mono-s text-muted">${h.x}, ${h.y} · ${h.w} × ${h.h} · ${{ 'press-in': 'Press-in', highlight: 'Highlight', ripple: 'Ripple' }[h.effect]}</p></div></li>`).join('');
  return `<div class="flex w-[1424px] bg-surface">
    ${playerFrame(art('home') + p.hotspots.map((h, i) => annotationMarker(h, i + 1)).join(''))}
    <aside class="w-[400px] flex-none" aria-label="Hotspot legend"><div class="px-4 py-3"><p class="text-overline uppercase text-muted">Handoff annotation · not shown to visitors</p><h3 class="text-heading-m">Home · 5 hotspots</h3><p class="text-body-s text-muted">Coordinates in page pixels (2048 × 1536).</p></div><ol>${legend}</ol></aside>
  </div>`;
}

/* Press effects on the Product A card, shown in a crop of the page */
function pressEffect(kind) {
  const h = page('home').hotspots[0];
  const pad = 24, x = ps(h.x), y = ps(h.y), w = ps(h.w), hh = ps(h.h), r = ps(h.r);
  const cw = w + pad * 2, ch = hh + pad * 2;
  const region = `left:${pad}px;top:${pad}px;width:${w}px;height:${hh}px;border-radius:${r}px`;
  let fx = '';
  if (kind === 'highlight') fx = `<div class="absolute" style="${region};background:color-mix(in srgb, var(--color-overlay-light) 24%, transparent)"></div>`;
  if (kind === 'press-in') fx = `<div class="absolute" style="${region};background:color-mix(in srgb, var(--color-overlay-dark) 10%, transparent);box-shadow:inset 0 6px 18px color-mix(in srgb, var(--color-overlay-dark) 35%, transparent)"></div>`;
  if (kind === 'ripple') fx = `<div class="absolute overflow-hidden" style="${region}"><span class="absolute rounded-full" style="left:${150 - 110}px;top:${170 - 110}px;width:220px;height:220px;background:color-mix(in srgb, var(--color-overlay-light) 34%, transparent)"></span></div>
      <span class="absolute h-7 w-7 rounded-full border-2 border-dashed" style="left:${pad + 150 - 14}px;top:${pad + 170 - 14}px;border-color:var(--color-overlay-dark)" title="Touch point (annotation)"></span>`;
  return `<div class="relative overflow-hidden rounded" style="width:${cw}px;height:${ch}px">
    <img src="${page('home').bg.src}" alt="" class="absolute max-w-none" style="width:${PW}px;height:${PH}px;left:${pad - x}px;top:${pad - y}px">${fx}</div>`;
}
function pressEffects() {
  const spec = {
    highlight: ['Highlight', 'A light wash over the hotspot shape. 80 ms in on touch-down, holds while pressed, 160 ms out.'],
    'press-in': ['Press-in', 'The shape darkens with an inner shadow, as if pushed into the screen. 80 ms in, 120 ms out.'],
    ripple: ['Ripple', 'A light circle grows from the touch point, clipped to the shape. 400 ms, ease-out. Dashed ring: touch point, annotation only.'],
  };
  return `<div class="flex gap-8 bg-surface p-6">${Object.entries(spec).map(([k, [t, d]]) => `<figure class="w-[328px] space-y-3">${pressEffect(k)}
    <figcaption><p class="text-label-m">${t}</p><p class="text-body-s text-secondary">${d}</p></figcaption></figure>`).join('')}</div>`;
}

/* Fade: Product A fades in on top of Home, which stays fully opaque underneath */
function fadeFrames() {
  const steps = [[0, '0 ms', 'Tap released on "Product A card". Product A is placed on top at 0%.'], [50, '150 ms', 'Product A at 50%. Home underneath stays at 100%.'], [100, '300 ms', 'Product A at 100%. Home is removed.']];
  return `<div class="flex gap-6 bg-surface p-6">${steps.map(([o, t, d]) => `<figure class="w-[320px] space-y-3">
    <div class="relative h-[240px] w-[320px] overflow-hidden rounded" style="background:${PROJECT.canvas.bg}">${o < 100 ? art('home') : ''}${art('product-a', `style="opacity:${o / 100}"`)}</div>
    <figcaption><p class="text-label-m"><span class="font-mono text-mono-m">${t}</span> · Product A ${o}%</p><p class="text-body-s text-secondary">${d}</p></figcaption></figure>`).join('')}</div>`;
}

/* Station not found: plain Tapcue page, for the integrator during setup */
function stationNotFound() {
  const rows = PROJECT.stations.map((s) => compactRow({ title: esc(s.name), meta: `<span class="font-mono text-mono-s text-secondary">${PROJECT.server}/play/${s.id}</span>`, trailing: icon('arrow-right', 'text-secondary') })).join('');
  return `<div class="flex h-[768px] w-[1024px] items-center justify-center bg-app p-8">
    <main class="w-[520px] space-y-5 rounded-xl border bg-surface p-8 shadow-1">
      <div class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true"></span><span class="text-heading-m">Tapcue</span></div>
      <div class="space-y-2"><h1 class="text-heading-xl">Station not found</h1>
        <p class="text-body-m text-secondary">This server has no station with the id <span class="rounded-sm bg-subtle px-1 font-mono text-mono-m text-primary">mian</span>. Check the address, or open one of these stations:</p></div>
      <ul class="-mx-2 space-y-0.5">${rows}</ul>
      <p class="text-body-s text-muted">Stations are set up in the editor at <span class="font-mono text-mono-s text-secondary">${PROJECT.server}/edit</span>.</p>
    </main></div>`;
}
