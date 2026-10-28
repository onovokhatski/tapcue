/* Hotspot overlay specimen: uses hotspotOverlay() from components.js */
(function () {
  /* Sample artwork (content, not UI tokens): each tile draws a card and a round button. */
  const art = {
    light: { bg: 'linear-gradient(160deg,#fbf7f0 0%,#ece2d0 100%)', card: 'background:#ffffff;box-shadow:0 8px 24px rgb(90 70 40 / .14)', text: '#2a2118', btn: 'background:#f4ede2;border:1px solid #d9ccb6', btnText: '#5a4a35' },
    mid:   { bg: 'linear-gradient(135deg,#f6b26b 0%,#d9576b 48%,#5b6fd6 100%)', card: 'background:rgb(255 255 255 / .22);border:1px solid rgb(255 255 255 / .4)', text: '#ffffff', btn: 'background:rgb(255 255 255 / .85)', btnText: '#7a2e5d' },
    dark:  { bg: 'radial-gradient(120% 90% at 25% 15%,#26345f 0%,#0b1020 72%)', card: 'background:linear-gradient(135deg,#2f3e6e,#18213f);box-shadow:0 0 36px rgb(120 160 255 / .22)', text: '#e6ecff', btn: 'background:#0b1020;border:1px solid #3b4c84', btnText: '#a9b8ef' },
  };
  const rows = document.getElementById('hotspot-matrix');
  ['idle', 'hover', 'selected'].forEach((state) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<th scope="row" class="align-top text-label-s capitalize text-secondary">${state}</th>` +
      ['light', 'mid', 'dark'].map((k) => {
        const a = art[k];
        return `<td class="align-top"><div class="relative h-[192px] w-[256px] rounded" style="background:${a.bg}">
          <div class="absolute flex flex-col justify-end p-3" style="left:20px;top:52px;width:136px;height:112px;border-radius:14px;${a.card}">
            <span style="color:${a.text};font:600 15px/1.2 var(--font-sans)">Product A</span>
            <span style="color:${a.text};opacity:.75;font:400 11px/1.3 var(--font-sans)">Tap to explore</span>
          </div>
          <div class="absolute flex items-center justify-center rounded-full" style="left:172px;top:76px;width:64px;height:64px;${a.btn}">
            <span style="color:${a.btnText};font:600 11px/1 var(--font-sans)">About</span>
          </div>
          ${hotspotOverlay({ x: 20, y: 52, w: 136, h: 112, shape: 'rect', r: 14, state, name: 'Product A card' })}
          ${hotspotOverlay({ x: 172, y: 76, w: 64, h: 64, shape: 'ellipse', state, name: 'About' })}
        </div></td>`;
      }).join('');
    rows.appendChild(tr);
  });
})();
