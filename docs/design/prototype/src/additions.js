/* v0.2 additions specimen, rendered with components.js */
(function () {
  const card = (title, use, body) => `<div class="min-w-0 space-y-3 rounded-lg border bg-surface p-5">
    <div><h3 class="text-heading-m">${title}</h3><p class="text-body-s text-secondary">${use}</p></div>${body}</div>`;
  const lab = (t) => `<p class="text-overline uppercase text-muted">${t}</p>`;
  const art = 'art/home.svg';
  document.getElementById('v02').innerHTML = [
    card('Toggle button', 'A Secondary button with aria-pressed, for on/off tools such as Show safe area.',
      `<div class="flex flex-wrap gap-6"><div class="space-y-2">${lab('Off')}${button({ icon: 'crop', label: 'Show safe area', pressed: false })}</div>
       <div class="space-y-2">${lab('On')}${button({ icon: 'crop', label: 'Show safe area', pressed: true })}</div></div>`),
    card('Field size S (28 px)', 'Text field and select in the properties panel, so they line up with number and colour fields.',
      `<div class="grid gap-3 sm:grid-cols-2">${textField({ id: 'v2-a', label: 'Name', value: 'Product A card', size: 's' })}${select({ id: 'v2-b', label: 'Send command to', value: 'Resolume', meta: 'OSC over UDP', size: 's' })}</div>`),
    card('Progress bar', 'Upload progress; always paired with a percentage or size in text.',
      `${progress({ value: 64, label: 'Upload' })}<p class="text-body-s text-muted tabular">64% · 82 of 128 MB</p>`),
    card('File row', 'A background file: ready, or uploading with progress and Cancel.',
      `${fileRow({ type: 'image', name: 'home.png', meta: 'Image · 2048 × 1536 · 1.8 MB', actions: button({ variant: 'ghost', size: 's', label: 'Replace' }) })}
       ${fileRow({ type: 'video', name: 'about-loop.mp4', meta: '64% · 82 of 128 MB', progressValue: 64, actions: button({ variant: 'ghost', size: 's', label: 'Cancel' }) })}`),
    card('Upload dropzone', 'Where a background has not been set, or after a failed upload. Limit: 200 MB.',
      `<div class="grid gap-3 sm:grid-cols-2"><div class="space-y-2">${lab('Default')}${dropzone()}</div><div class="space-y-2">${lab('File dragged over')}${dropzone({ active: true })}</div></div>`),
    card('Panel section and form row', 'Groups in the properties panel: overline title, optional action, stacked or inline fields.',
      `<div class="rounded-lg border">${panelSection({ title: 'Position and size', body: `<div class="grid grid-cols-4 gap-1.5">${numberField({ prefix: 'X', value: 144 })}${numberField({ prefix: 'Y', value: 500 })}${numberField({ prefix: 'W', value: 560 })}${numberField({ prefix: 'H', value: 720 })}</div>${formRow('Opacity', `<div class="w-[96px]">${numberField({ value: 100, suffix: '%', ariaLabel: 'Opacity' })}</div>`)}` })}</div>`),
    card('Safe-area overlay', 'Editor canvas only. Hatched bands mark what Fill crops on the reference screen; the hotspot chip turns to a warning when a hotspot crosses them.',
      `<div class="relative max-w-full overflow-x-auto pb-1"><div class="relative aspect-[4/3] rounded" style="width:384px;margin-right:48px">
        <img src="${art}" alt="" class="absolute inset-0 h-full w-full">
        <div class="crop-zone top-0" style="height:24px"></div><div class="crop-zone bottom-0" style="height:24px"></div>
        <div class="safe-line" style="top:24px"></div><div class="safe-line" style="top:264px"></div>
        <span class="canvas-chip absolute bottom-1 left-2">${icon('crop', 'h-3 w-3')}Cropped on 16:10 in Fill · 128 px</span>
        ${hotspotOverlay({ x: 299, y: 14, w: 59, h: 18, r: 9, shape: 'rect', state: 'selected', name: 'Call our team', warn: true, chipBelow: true })}
      </div></div>`),
    card('Empty canvas', 'A page with no background. The whole canvas accepts a drop.',
      `<div class="relative aspect-[4/3] max-w-full rounded" style="width:384px;background:#000">
        <div class="canvas-empty absolute inset-3 flex flex-col items-center justify-center gap-2 rounded-lg text-center">${icon('upload', 'h-6 w-6')}<p class="text-label-m">No background yet</p><p class="max-w-[240px] text-body-s opacity-80">Drop an image or video here, or choose a file in the panel.</p></div></div>`),
  ].join('');
})();
