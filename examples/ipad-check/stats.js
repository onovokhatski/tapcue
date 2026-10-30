// On-screen stats for the iPad check (issue #30), for when Web Inspector is not at hand.
// make.mjs copies this file into assets/, the server serves it at /assets/stats.js, and
// index.html loads it when the page URL has ?stats. Delete with this folder once #30 is done.
/* global document, performance, requestAnimationFrame, setInterval */
(() => {
  const LONG_FRAME_MS = 50;
  const started = performance.now();
  let longFrames = 0;
  let lastFrame = started;
  // Worst dropped share seen per page since load: a warm video's element (and its counters)
  // goes away when the page stops being warm, so the overlay keeps the worst value itself.
  const worst = new Map();

  const box = document.createElement('pre');
  box.style.cssText =
    'position:fixed;top:8px;left:8px;z-index:2147483647;margin:0;padding:8px 10px;' +
    'font:12px/1.4 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.7);' +
    'border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(box);

  // A main-thread frame longer than LONG_FRAME_MS is a visible hitch.
  function frame(now) {
    if (now - lastFrame > LONG_FRAME_MS) longFrames += 1;
    lastFrame = now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function percent(dropped, total) {
    return total === 0 ? 0 : (100 * dropped) / total;
  }

  function render() {
    const seconds = Math.floor((performance.now() - started) / 1000);
    const uptime = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const rows = [...document.querySelectorAll('[data-layer] video')].map((video) => {
      const layer = video.closest('[data-layer]');
      const quality = video.getVideoPlaybackQuality();
      const dropped = percent(quality.droppedVideoFrames, quality.totalVideoFrames);
      const page = layer.dataset.page;
      worst.set(page, Math.max(worst.get(page) ?? 0, dropped));
      return [
        page.padEnd(9),
        layer.dataset.layer.padEnd(9),
        (video.paused ? 'paused' : 'playing').padEnd(8),
        `ready ${video.readyState}`,
        `dropped ${quality.droppedVideoFrames}/${quality.totalVideoFrames}`,
      ].join(' ');
    });
    const worstRow = [...worst]
      .map(([page, value]) => `${page.replace('p_vid00', 'V')} ${value.toFixed(1)}%`)
      .join('  ');
    box.textContent = [
      `up ${uptime}   long frames (>${LONG_FRAME_MS} ms): ${longFrames}`,
      ...rows,
      `worst dropped: ${worstRow || '-'}`,
    ].join('\n');
  }
  render();
  setInterval(render, 1000);
})();
