const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = path.resolve('out');
const jobs = [
  ['tapcue-icon.svg', 'apple-touch-icon.png', 180, 180, false],
  ['tapcue-icon-rounded.svg', 'icon-192.png', 192, 192, true],
  ['tapcue-icon-rounded.svg', 'icon-512.png', 512, 512, true],
  ['tapcue-icon-maskable.svg', 'icon-maskable-512.png', 512, 512, false],
  ['favicon.svg', 'favicon-32.png', 32, 32, true],
  ['tapcue-logo-light.svg', 'tapcue-logo-light@2x.png', null, null, true],
  ['tapcue-logo-dark.svg', 'tapcue-logo-dark@2x.png', null, null, true],
];
(async () => {
  const b = await chromium.launch();
  for (const [src, dst, w, h, transparent] of jobs) {
    const svg = fs.readFileSync(path.join(out, src), 'utf8');
    const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); const vw = +m[1], vh = +m[2];
    const scale = w ? 1 : 2; const W = w || Math.round(vw * 2), H = h || Math.round(vh * 2);
    const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const data = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    await p.setContent(`<html><body style="margin:0;background:transparent"><img src="${data}" style="display:block;width:${W}px;height:${H}px"></body></html>`);
    await p.waitForTimeout(100);
    await p.screenshot({ path: path.join(out, dst), omitBackground: transparent });
    await p.close(); console.log(dst, W, H);
  }
  await b.close();
})();
