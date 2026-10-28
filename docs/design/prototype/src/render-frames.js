function renderFrames(groups) {
  document.getElementById('frames').innerHTML = groups.map((g) => `${g.title ? `<div id="${g.id}" class="scroll-mt-20 space-y-1 border-t pt-8"><p class="text-overline uppercase text-muted">${g.eyebrow}</p><h2 class="text-heading-xl">${g.title}</h2>${g.note ? `<p class="max-w-[90ch] text-body-m text-secondary">${g.note}</p>` : ''}</div>` : ''}
    ${g.frames.map((f) => `<section aria-labelledby="f${f.n}-t" class="space-y-3">
      <div class="max-w-[90ch] space-y-1"><p class="text-overline uppercase text-muted">Frame ${f.n}${f.size ? ` · ${f.size}` : ''}</p><h3 id="f${f.n}-t" class="text-heading-l">${f.title}</h3><p class="text-body-m text-secondary">${f.note}</p></div>
      <div class="relative overflow-x-auto rounded-lg border bg-surface shadow-1"><div data-frame>${f.html}</div></div></section>`).join('')}`).join('<div class="h-4"></div>');
}
