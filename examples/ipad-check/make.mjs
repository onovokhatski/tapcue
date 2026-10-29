// Builds the temporary iPad test project for issue #30: a hub and six video pages, each linking to
// all the others, so every page has five video neighbours to keep warm. macOS only: it uses the
// Swift tools of the demo stand to draw the pages and encode the loops.
// Usage: node examples/ipad-check/make.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const TOOLS = join(HERE, '../demo-stand/make-assets');
const ASSETS = join(HERE, 'assets');
const W = 2048;
const H = 1536;
const VIDEOS = 6;

const pages = [
  { id: 'p_hub000', name: 'Hub', label: 'Hub', colour: '#44403c', asset: 'assets/hub.jpg' },
  ...Array.from({ length: VIDEOS }, (_, i) => ({
    id: `p_vid00${i + 1}`,
    name: `Video ${i + 1}`,
    label: `V${i + 1}`,
    // Hues spread around the wheel, so each page is easy to tell apart at a glance.
    colour: `hsl(${i * 60}, 55%, 38%)`,
    asset: `assets/video-${i + 1}.mp4`,
  })),
];

// The navigation row: one button for every other page, in page order.
const BUTTON = { width: 240, height: 160, gap: 40, y: 1300 };
function buttonX(index) {
  return 64 + index * (BUTTON.width + BUTTON.gap);
}

function svg(page, pageIndex) {
  const buttons = pages
    .map((target, i) =>
      i === pageIndex
        ? ''
        : `<rect x="${buttonX(i)}" y="${BUTTON.y}" width="${BUTTON.width}" height="${BUTTON.height}" rx="32" fill="#ffffff" fill-opacity="0.9"/>
           <text x="${buttonX(i) + BUTTON.width / 2}" y="${BUTTON.y + 104}" font-family="Helvetica" font-size="72" font-weight="bold" text-anchor="middle" fill="#1c1917">${target.label}</text>`,
    )
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${page.colour}"/>
  <text x="${W / 2}" y="640" font-family="Helvetica" font-size="220" font-weight="bold" text-anchor="middle" fill="#ffffff">${page.name}</text>
  <text x="${W / 2}" y="800" font-family="Helvetica" font-size="64" text-anchor="middle" fill="#ffffff" fill-opacity="0.8">Tapcue warm-video test (issue #30)</text>
  ${buttons}
</svg>`;
}

function hotspots(pageIndex) {
  return pages.flatMap((target, i) =>
    i === pageIndex
      ? []
      : [
          {
            id: `h_p${pageIndex}b${i}00`,
            name: target.name,
            x: buttonX(i),
            y: BUTTON.y,
            width: BUTTON.width,
            height: BUTTON.height,
            shape: { type: 'rect', cornerRadius: 32 },
            style: { fill: null, border: null, opacity: 1 },
            pressEffect: 'highlight',
            action: { goTo: target.id, command: null },
          },
        ],
  );
}

const project = {
  schemaVersion: 1,
  name: 'iPad check',
  canvas: { width: W, height: H, scaleMode: 'fit', backgroundColor: '#000000' },
  pages: pages.map((page, i) => ({
    id: page.id,
    name: page.name,
    background: { type: i === 0 ? 'image' : 'video', asset: page.asset },
    hotspots: hotspots(i),
  })),
  targets: [],
  // No idle return: it would interrupt a 10-minute browsing run.
  stations: [{ id: 'ipad', name: 'iPad check', startPageId: 'p_hub000', idleTimeoutSeconds: null }],
};

mkdirSync(ASSETS, { recursive: true });
writeFileSync(join(HERE, 'project.json'), `${JSON.stringify(project, null, 2)}\n`);

const tmp = mkdtempSync(join(tmpdir(), 'tapcue-ipad-check-'));
try {
  pages.forEach((page, i) => {
    const svgPath = join(tmp, `${i}.svg`);
    const pngPath = join(tmp, `${i}.png`);
    writeFileSync(svgPath, svg(page, i));
    // svg2png prints each file it writes, which doubles as progress output.
    execFileSync('swift', [join(TOOLS, 'svg2png.swift'), svgPath, pngPath, String(W), String(H)], {
      stdio: 'inherit',
    });
    const out = join(HERE, page.asset);
    if (i === 0) {
      execFileSync('sips', ['-s', 'format', 'jpeg', pngPath, '--out', out], { stdio: 'ignore' });
    } else {
      execFileSync('swift', [join(TOOLS, 'loop.swift'), pngPath, out]);
    }
  });
} finally {
  rmSync(tmp, { recursive: true });
}
