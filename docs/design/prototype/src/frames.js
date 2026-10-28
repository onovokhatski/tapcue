/* Shared frame viewer: scales each 1440-wide frame to the available width (or 100%). */
(function () {
  const frames = [...document.querySelectorAll('[data-frame]')];
  const btns = document.querySelectorAll('[data-zoom]');
  let mode = 'fit';
  function apply() {
    frames.forEach((f) => {
      const host = f.parentElement; const w = f.firstElementChild.offsetWidth;
      f.style.zoom = mode === 'fit' ? Math.min(1, host.clientWidth / w) : 1;
    });
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zoom === mode)));
  }
  btns.forEach((b) => b.addEventListener('click', () => { mode = b.dataset.zoom; apply(); }));
  window.addEventListener('resize', apply); apply();
})();
