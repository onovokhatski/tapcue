/* Demo project shared by every Tapcue screen (editor, player, demo receiver).
   Coordinates are page pixels on the 2048 x 1536 canvas. */
const PROJECT = {
  name: 'Demo stand',
  server: 'http://192.168.1.10:4000',
  canvas: { w: 2048, h: 1536, bg: '#000000', scale: 'fill' },
  targets: [
    { id: 'resolume', name: 'Resolume', protocol: 'osc', host: '192.168.1.20', port: 7000 },
    { id: 'projector', name: 'Projector', protocol: 'udp', host: '192.168.1.40', port: 4352 },
    { id: 'demo', name: 'Demo receiver', protocol: 'http', baseUrl: 'http://localhost:4000' },
  ],
  stations: [
    { id: 'main', name: 'Main catalog', start: 'home', idle: 90 },
    { id: 'small', name: 'Small screen', start: 'product-a', idle: 60 },
  ],
  pages: [
    {
      id: 'home', name: 'Home',
      bg: { type: 'image', file: 'home.png', src: 'art/home.svg', size: '1.8 MB' },
      hotspots: [
        { id: 'hs-a', name: 'Product A card', shape: 'rect', x: 144, y: 500, w: 560, h: 720, r: 40, effect: 'press-in',
          goto: 'product-a', target: 'resolume', osc: { address: '/composition/columns/2/connect', args: [{ type: 'int', value: '1' }] } },
        { id: 'hs-b', name: 'Product B card', shape: 'rect', x: 744, y: 500, w: 560, h: 720, r: 40, effect: 'press-in',
          goto: 'product-b', target: 'resolume', osc: { address: '/composition/columns/3/connect', args: [{ type: 'int', value: '1' }] } },
        { id: 'hs-c', name: 'Product C card', shape: 'rect', x: 1344, y: 500, w: 560, h: 720, r: 40, effect: 'ripple',
          goto: null, target: 'resolume', osc: { address: '/composition/columns/4/connect', args: [{ type: 'int', value: '1' }] } },
        { id: 'hs-about', name: 'About', shape: 'ellipse', x: 1760, y: 1244, w: 144, h: 144, effect: 'highlight', goto: 'about',
          target: 'demo', http: { method: 'POST', path: '/demo/screen-2/about-us', body: '' } },
        { id: 'hs-call', name: 'Call our team', shape: 'rect', x: 1592, y: 76, w: 312, h: 96, r: 48, effect: 'highlight',
          goto: null, target: 'demo', http: { method: 'POST', path: '/demo/screen-3/call-staff', body: '{ "stand": "B12" }' } },
      ],
    },
    {
      id: 'product-a', name: 'Product A',
      bg: { type: 'image', file: 'product-a.png', src: 'art/product-a.svg', size: '2.1 MB' },
      hotspots: [
        { id: 'pa-back', name: 'Back', shape: 'rect', x: 120, y: 176, w: 236, h: 88, r: 44, effect: 'highlight', goto: 'home', target: null },
        { id: 'pa-play', name: 'Play demo', shape: 'rect', x: 1120, y: 1040, w: 600, h: 112, r: 56, effect: 'press-in',
          goto: null, target: 'demo', http: { method: 'POST', path: '/demo/screen-1/product-a', body: '' } },
        { id: 'pa-next', name: 'Next product', shape: 'rect', x: 1104, y: 1224, w: 400, h: 72, r: 8, effect: 'highlight', goto: 'product-b', target: null },
      ],
    },
    {
      id: 'product-b', name: 'Product B',
      bg: { type: 'image', file: 'product-b.png', src: 'art/product-b.svg', size: '2.4 MB' },
      hotspots: [
        { id: 'pb-back', name: 'Back', shape: 'rect', x: 120, y: 176, w: 236, h: 88, r: 44, effect: 'highlight', goto: 'home', target: null },
        { id: 'pb-play', name: 'Play demo', shape: 'rect', x: 144, y: 940, w: 600, h: 112, r: 56, effect: 'press-in',
          goto: null, target: 'demo', http: { method: 'POST', path: '/demo/screen-1/product-b', body: '' } },
        { id: 'pb-wall', name: 'Show on the wall', shape: 'rect', x: 144, y: 1092, w: 600, h: 112, r: 56, effect: 'press-in',
          goto: null, target: 'projector', udp: { text: '%1INPT 31\\r' } },
      ],
    },
    {
      id: 'about', name: 'About us',
      bg: { type: 'video', file: 'about-loop.mp4', src: 'art/about.svg', size: '128 MB', duration: '0:24' },
      hotspots: [
        { id: 'ab-back', name: 'Back', shape: 'rect', x: 120, y: 176, w: 236, h: 88, r: 44, effect: 'highlight', goto: 'home', target: null },
      ],
    },
  ],
};
const page = (id) => PROJECT.pages.find((p) => p.id === id);
const target = (id) => PROJECT.targets.find((t) => t.id === id);
const PROTOCOL_LABEL = { osc: 'OSC over UDP', udp: 'UDP', http: 'HTTP' };

/* Commands as they appear in the log, newest first */
const LOG = [
  { time: '14:32:07.418', result: 'sent', source: 'Main catalog', hotspot: 'Product A card', target: 'Resolume', command: '/composition/columns/2/connect', args: 'i 1', navigateTo: 'Product A' },
  { time: '14:32:05.120', result: 'sent', source: 'test', hotspot: 'Product A card', target: 'Resolume', command: '/composition/columns/2/connect', args: 'i 1' },
  { time: '14:31:52.006', result: 'error', source: 'Small screen', hotspot: 'Call our team', target: 'Demo receiver', command: 'POST /demo/screen-3/call-staff', error: 'Timed out after 2 s' },
  { time: '14:31:40.771', result: 'navigation', source: 'Small screen', hotspot: 'Back', from: 'Product B', navigateTo: 'Home' },
  { time: '14:31:12.360', result: 'sent', source: 'Main catalog', hotspot: 'Play demo', target: 'Demo receiver', command: 'POST /demo/screen-1/product-b', args: '200 OK' },
];

/* Reference screens: an editor preference (this browser), not saved in the project */
const REFERENCE = {
  '16:10': { label: '16:10 · 1280 × 800', w: 1280, h: 800 },
  '16:9': { label: '16:9 · 1920 × 1080', w: 1920, h: 1080 },
};
/* Page px cropped at each edge in Fill mode: { top, side } */
function cropBands(ref) {
  const r = REFERENCE[ref], { w, h } = PROJECT.canvas;
  const scale = Math.max(r.w / w, r.h / h);
  return { top: Math.round((h - r.h / scale) / 2), side: Math.round((w - r.w / scale) / 2) };
}
function croppedBy(hs, ref) {
  if (PROJECT.canvas.scale !== 'fill') return 0;
  const b = cropBands(ref), { w, h } = PROJECT.canvas;
  return Math.max(b.top - hs.y, hs.y + hs.h - (h - b.top), b.side - hs.x, hs.x + hs.w - (w - b.side), 0);
}
