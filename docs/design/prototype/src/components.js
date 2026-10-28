/* =====================================================================
   Tapcue components as plain template functions.
   Each function returns the exact markup of one design-system component,
   built only from token utilities. They are the reference for the React
   components: same names, same props.
   ===================================================================== */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/* ---------- Button ---------- */
const BTN_VARIANT = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-pressed',
  secondary: 'border border-strong bg-surface text-primary hover:bg-hover active:bg-pressed',
  ghost: 'text-secondary hover:bg-hover hover:text-primary active:bg-pressed',
  danger: 'bg-danger-solid text-on-danger hover:bg-danger-hover active:bg-danger-pressed',
};
const BTN_DISABLED = {
  primary: 'bg-disabled text-disabled', secondary: 'border border-default bg-disabled text-disabled',
  ghost: 'text-disabled', danger: 'bg-disabled text-disabled',
};
const BTN_TOGGLE_ON = 'border border-selection bg-selection text-primary hover:bg-accent-subtle';
function button({ variant = 'secondary', size = 'm', icon: ic, label = '', ariaLabel, disabled, pressed, busy, cls = '', tag = 'button' }) {
  const iconOnly = !label;
  const sizeCls = size === 's'
    ? (iconOnly ? 'h-7 w-7 justify-center' : 'h-7 gap-1.5 px-2 text-label-s')
    : (iconOnly ? 'h-8 w-8 justify-center' : 'h-8 gap-2 px-3 text-label-m');
  const look = disabled ? `${BTN_DISABLED[variant]} cursor-not-allowed` : pressed ? BTN_TOGGLE_ON : BTN_VARIANT[variant];
  const attrs = [
    tag === 'button' ? 'type="button"' : '',
    disabled ? 'disabled' : '',
    pressed !== undefined ? `aria-pressed="${pressed ? 'true' : 'false'}"` : '',
    iconOnly ? `aria-label="${esc(ariaLabel)}"` : '',
  ].join(' ');
  const iconCls = size === 's' ? 'h-3.5 w-3.5' : '';
  const lead = busy ? '<span class="spinner" aria-hidden="true"></span>' : ic ? icon(ic, iconCls) : '';
  return `<${tag} ${attrs} ${busy ? 'aria-busy="true"' : ''} class="inline-flex flex-none items-center rounded ${sizeCls} ${look} ${cls}">${lead}${esc(label)}</${tag}>`;
}

/* ---------- Status badge ---------- */
function badge(status, label) {
  const B = 'inline-flex h-6 flex-none items-center gap-1.5 rounded-full border px-2 text-label-s';
  switch (status) {
    case 'connected': return `<span role="status" class="${B} border-success bg-success-bg text-success-fg"><span class="h-2 w-2 rounded-full bg-success-solid" aria-hidden="true"></span>${label || 'Connected'}</span>`;
    case 'disconnected': return `<span role="status" class="${B} border-danger bg-danger-bg text-danger-fg">${icon('wifi-off', 'h-3.5 w-3.5')}${label || 'Disconnected'}</span>`;
    case 'saving': return `<span role="status" class="${B} bg-subtle text-secondary"><span class="spinner h-3 w-3" aria-hidden="true"></span>${label || 'Saving…'}</span>`;
    case 'saved': return `<span role="status" class="${B} bg-subtle text-secondary">${icon('check', 'h-3.5 w-3.5 text-success-solid')}${label || 'Saved'}</span>`;
    case 'error': return `<span role="status" class="${B} border-danger bg-danger-bg text-danger-fg">${icon('alert', 'h-3.5 w-3.5')}${label || 'Save error'}</span>`;
    case 'sent': return `<span class="${B} border-success bg-success-bg text-success-fg">${icon('check', 'h-3.5 w-3.5')}${label || 'Sent'}</span>`;
    case 'unsaved': return `<span role="status" class="${B} bg-subtle text-secondary"><span class="h-2 w-2 rounded-full border-[1.5px] border-current" aria-hidden="true"></span>${label || 'Unsaved changes'}</span>`;
    case 'waiting': return `<span role="status" class="${B} bg-subtle text-secondary"><span class="spinner h-3 w-3" aria-hidden="true"></span>${label || 'Waiting'}</span>`;
    case 'demo': return `<span role="status" class="${B} border-info bg-info-bg text-info-fg">${icon('info', 'h-3.5 w-3.5')}${label || 'Demo mode · not saved'}</span>`;
  }
}
const testTag = () => `<span class="inline-flex h-5 items-center rounded-sm border border-strong px-1.5 text-label-s text-secondary">Test</span>`;

/* ---------- Field parts ---------- */
const fieldLabel = (id, label, disabled) => label ? `<label for="${id}" class="block text-label-s ${disabled ? 'text-disabled' : 'text-secondary'}">${esc(label)}</label>` : '';
const fieldMessage = (id, helper, error) => error
  ? `<p id="${id}-msg" class="flex items-start gap-1 text-body-s text-danger-fg">${icon('alert', 'mt-px h-3.5 w-3.5')}<span>${esc(error)}</span></p>`
  : helper ? `<p id="${id}-msg" class="text-body-s text-muted">${helper}</p>` : '';
const FIELD_H = { m: 'h-8', s: 'h-7' };

/* ---------- Text field ---------- */
function textField({ id, label, value = '', placeholder = '', helper, error, mono, multiline, rows = 3, disabled, readonly, size = 'm', prefix, ariaLabel }) {
  const font = mono ? 'font-mono text-mono-m' : 'text-body-m';
  const state = disabled ? 'cursor-not-allowed border-default bg-disabled text-disabled' : error ? 'field field-error bg-surface' : 'field border-strong bg-surface';
  const aria = `${error ? 'aria-invalid="true"' : ''} ${helper || error ? `aria-describedby="${id}-msg"` : ''} ${!label && ariaLabel ? `aria-label="${esc(ariaLabel)}"` : ''}`;
  let control;
  if (multiline) {
    control = `<textarea id="${id}" rows="${rows}" ${aria} ${disabled ? 'disabled' : ''} placeholder="${esc(placeholder)}" class="block w-full resize-y rounded border px-3 py-1.5 ${font} ${state} placeholder:text-muted">${esc(value)}</textarea>`;
  } else if (prefix) {
    control = `<div class="flex ${FIELD_H[size]} items-center rounded border ${state} min-w-0"><span class="flex-none select-none border-r border-default pl-2 pr-2 font-mono text-mono-s text-muted">${esc(prefix)}</span><input id="${id}" ${aria} ${disabled ? 'disabled' : ''} class="h-full w-full min-w-0 bg-transparent px-2 ${font} outline-none" value="${esc(value)}" placeholder="${esc(placeholder)}"></div>`;
  } else {
    control = `<input id="${id}" ${aria} ${disabled ? 'disabled' : ''} ${readonly ? 'readonly' : ''} class="${FIELD_H[size]} w-full min-w-0 rounded border px-3 ${font} ${state} ${readonly ? '!bg-subtle' : ''} placeholder:text-muted" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
  }
  return `<div class="min-w-0 space-y-1">${fieldLabel(id, label, disabled)}${control}${fieldMessage(id, helper, error)}</div>`;
}

/* ---------- Select (closed) ---------- */
function select({ id, label, value, meta, placeholder = 'None', disabled, size = 'm', helper, ariaLabel, mono }) {
  const state = disabled ? 'cursor-not-allowed border-default bg-disabled text-disabled' : 'border-strong bg-surface hover:bg-hover';
  const text = value ? `<span class="min-w-0 flex-1 truncate ${mono ? 'font-mono text-mono-m' : ''}">${esc(value)}</span>` : `<span class="min-w-0 flex-1 truncate text-muted">${esc(placeholder)}</span>`;
  const aria = label ? `aria-labelledby="${id}-l ${id}"` : `aria-label="${esc(ariaLabel)}"`;
  return `<div class="min-w-0 space-y-1">${label ? `<p id="${id}-l" class="text-label-s ${disabled ? 'text-disabled' : 'text-secondary'}">${esc(label)}</p>` : ''}
    <button type="button" id="${id}" aria-haspopup="listbox" ${aria} ${disabled ? 'disabled' : ''} class="flex ${FIELD_H[size]} w-full items-center gap-2 rounded border pl-3 pr-2 text-left text-body-m ${state}">
      ${text}${meta ? `<span class="flex-none text-body-s ${disabled ? '' : 'text-muted'}">${esc(meta)}</span>` : ''}${icon('chevron-down', disabled ? '' : 'text-secondary')}
    </button>${fieldMessage(id, helper)}</div>`;
}

/* ---------- Number field ---------- */
function numberField({ prefix, value, suffix, error, disabled, ariaLabel, cls = '' }) {
  const state = disabled ? 'cursor-not-allowed border-default bg-disabled' : error ? 'field field-error bg-surface' : 'field border-strong bg-surface';
  return `<label class="flex h-7 min-w-0 items-center gap-1.5 rounded border px-2 ${state} ${cls}">${prefix ? `<span class="text-label-s ${disabled ? 'text-disabled' : 'text-muted'}">${prefix}</span>` : ''}<input ${disabled ? 'disabled' : ''} aria-label="${esc(ariaLabel || prefix)}" ${error ? 'aria-invalid="true"' : ''} inputmode="numeric" class="w-full min-w-0 bg-transparent text-right text-body-m tabular outline-none ${disabled ? 'text-disabled' : ''}" value="${esc(value)}">${suffix ? `<span class="text-body-s text-muted">${suffix}</span>` : ''}</label>`;
}

/* ---------- Colour field ---------- */
function colorField({ value, ariaLabel }) {
  if (!value) return `<div class="field flex h-7 min-w-0 items-center gap-2 rounded border border-strong bg-surface pl-1 pr-2"><button type="button" aria-label="Pick ${esc(ariaLabel)}" class="swatch-none h-5 w-5 flex-none rounded-sm border border-strong"></button><span class="flex-1 text-body-m text-muted">None</span></div>`;
  return `<div class="field flex h-7 min-w-0 items-center gap-2 rounded border border-strong bg-surface pl-1 pr-1"><button type="button" aria-label="Pick ${esc(ariaLabel)}" class="h-5 w-5 flex-none rounded-sm border border-strong" style="background:${value}"></button><input aria-label="${esc(ariaLabel)} hex" class="w-full min-w-0 bg-transparent font-mono text-mono-m uppercase outline-none" value="${value}"><button type="button" aria-label="Set ${esc(ariaLabel)} to None" class="inline-flex h-5 w-5 flex-none items-center justify-center rounded-sm text-muted hover:bg-hover hover:text-primary">${icon('close', 'h-3.5 w-3.5')}</button></div>`;
}

/* ---------- Segmented control ---------- */
function segmented({ label, options, value, disabled }) {
  return `<div role="radiogroup" aria-label="${esc(label)}" class="inline-flex flex-none rounded ${disabled ? 'bg-disabled' : 'bg-pressed'} p-0.5">${options.map((o) => {
    const on = o === value;
    return `<button type="button" role="radio" aria-checked="${on}" ${disabled ? 'disabled' : ''} class="h-6 rounded-sm px-2.5 text-label-s ${on ? 'bg-surface text-primary shadow-1' : disabled ? 'text-disabled' : 'text-secondary hover:text-primary'}">${esc(o)}</button>`;
  }).join('')}</div>`;
}

/* ---------- Banner ---------- */
function banner({ tone = 'info', title, body, dismissible, action }) {
  const T = {
    info: ['border-info bg-info-bg text-info-fg', 'info', 'text-info-solid', 'status'],
    warning: ['border-warning bg-warning-bg text-warning-fg', 'alert', 'text-warning-solid', 'status'],
    error: ['border-danger bg-danger-bg text-danger-fg', 'alert', 'text-danger-fg', 'alert'],
  }[tone];
  return `<div role="${T[3]}" class="flex gap-3 rounded-lg border p-3 ${T[0]}">${icon(T[1], `mt-0.5 ${T[2]}`)}
    <div class="min-w-0 flex-1 text-body-m"><p class="font-semibold">${title}</p>${body ? `<p>${body}</p>` : ''}${action ? `<div class="mt-2">${action}</div>` : ''}</div>
    ${dismissible ? `<button type="button" aria-label="Dismiss" class="inline-flex h-6 w-6 flex-none items-center justify-center rounded hover:bg-surface">${icon('close')}</button>` : ''}</div>`;
}

/* ---------- Progress bar (added v0.2) ---------- */
function progress({ value, label }) {
  return `<div role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" class="h-1.5 w-full overflow-hidden rounded-full bg-pressed"><div class="h-full rounded-full bg-accent" style="width:${value}%"></div></div>`;
}

/* ---------- Upload dropzone (added v0.2) ---------- */
function dropzone({ active, disabled } = {}) {
  if (disabled) return `<div class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-default bg-disabled px-4 py-5 text-center">${icon('upload', 'text-disabled')}<p class="text-label-m text-disabled">Uploads are off in demo mode</p>${button({ size: 's', label: 'Choose file', disabled: true })}<p class="text-body-s text-muted">Run Tapcue on your own server to upload backgrounds.</p></div>`;
  return `<div class="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center ${active ? 'border-focus bg-accent-subtle' : 'border-strong bg-subtle'}">
    ${icon('upload', active ? 'text-accent-strong' : 'text-secondary')}
    <p class="text-label-m">${active ? 'Release to upload' : 'Drop an image or video'}</p>
    ${active ? '' : button({ size: 's', label: 'Choose file' })}
    <p class="text-body-s text-muted">PNG, JPG, WebP, MP4 or WebM, up to 200 MB. 2048 × 1536 fits the canvas exactly.</p>
  </div>`;
}

/* ---------- File row (added v0.2) ---------- */
function fileRow({ type, name, meta, actions = '', progressValue }) {
  return `<div class="space-y-2 rounded-lg border bg-surface p-2.5">
    <div class="flex items-center gap-2.5">
      <span class="flex h-8 w-8 flex-none items-center justify-center rounded bg-subtle text-secondary">${icon(type === 'video' ? 'video' : 'image')}</span>
      <div class="min-w-0 flex-1"><p class="truncate font-mono text-mono-s text-primary">${esc(name)}</p><p class="truncate text-body-s text-muted">${meta}</p></div>
      ${actions}
    </div>${progressValue !== undefined ? progress({ value: progressValue, label: `Uploading ${name}` }) : ''}
  </div>`;
}

/* ---------- Panel section + inline row (added v0.2) ---------- */
function panelSection({ title, action = '', body, id }) {
  return `<section ${id ? `id="${id}"` : ''} class="space-y-3 border-b px-4 py-4" aria-label="${esc(title)}">
    <div class="flex min-h-[20px] items-center justify-between gap-2"><h3 class="text-overline uppercase text-muted">${esc(title)}</h3>${action}</div>${body}</section>`;
}
const formRow = (label, control, forId) => `<div class="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2">${forId ? `<label for="${forId}" class="text-label-s text-secondary">${label}</label>` : `<span class="text-label-s text-secondary">${label}</span>`}<div class="flex min-w-0 items-center gap-2">${control}</div></div>`;

/* ---------- Top bar with tabs ---------- */
function topBar({ tab = 'Pages', conn = 'connected', save = 'saved', demo } = {}) {
  const tabs = ['Pages', 'Targets', 'Stations', 'Settings'].map((t) => t === tab
    ? `<a href="#" aria-current="page" class="relative flex items-center px-3 text-label-m text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent-strong">${t}</a>`
    : `<a href="#" class="flex items-center px-3 text-label-m text-secondary hover:text-primary">${t}</a>`).join('');
  return `<header class="flex h-12 flex-none items-stretch gap-5 border-b bg-surface pl-4 pr-3">
    <div class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-subtle)]" aria-hidden="true"></span><span class="text-heading-m">Tapcue</span><span class="text-body-m text-muted">/</span><span class="text-label-m text-secondary">${esc(PROJECT.name)}</span></div>
    <nav aria-label="Editor" class="flex items-stretch">${tabs}</nav>
    <div class="ml-auto flex items-center gap-2">${badge(conn, conn === 'waiting' ? 'Connecting…' : undefined)}${demo ? badge('demo') : save ? badge(save) : ''}</div>
  </header>`;
}

/* ---------- Hotspot overlay (editor canvas only) ----------
   warn: hotspot reaches into a band cropped in Fill mode (shown even when "Show safe area" is off).
   chipBelow: place the chip under the hotspot when there is no room above. */
function hotspotOverlay({ x, y, w, h, shape, state, name, r = 0, warn, chipBelow }) {
  const geom = shape === 'ellipse'
    ? (cls) => `<ellipse class="${cls}" cx="50%" cy="50%" rx="50%" ry="50%"/>`
    : (cls) => `<rect class="${cls}" x="0" y="0" width="100%" height="100%" rx="${r}"/>`;
  const handles = state === 'selected'
    ? [[0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50]]
      .map(([hx, hy]) => `<span class="hs-handle" style="left:${hx}%;top:${hy}%"></span>`).join('') : '';
  const pos = chipBelow ? 'style="bottom:auto;top:calc(100% + 6px)"' : '';
  const warnIcon = warn ? icon('alert', 'h-3 w-3') : '';
  let chip = '';
  if (state === 'selected') chip = `<span class="hs-chip ${warn ? 'hs-chip-warn' : ''}" ${pos}>${warnIcon}${esc(name)}</span>`;
  else if (state === 'hover') chip = `<span class="hs-chip ${warn ? 'hs-chip-warn' : 'hs-chip-idle'}" ${pos}>${warnIcon}${esc(name)}</span>`;
  else if (warn) chip = `<span class="hs-chip hs-chip-warn" ${pos} title="Partly cropped in Fill">${warnIcon}<span class="sr-only">${esc(name)} is partly cropped</span></span>`;
  const focus = state === 'focus';
  return `<div class="absolute ${focus ? 'hs-focus' : ''}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">
    <svg class="hs" data-state="${focus ? 'hover' : state}" style="inset:0" width="100%" height="100%" aria-hidden="true">${geom('hs-fill')}${geom('hs-under')}${geom('hs-line')}</svg>${focus ? `<span class="hs-chip hs-chip-idle" ${pos}>${esc(name)}</span>` : chip}${handles}</div>`;
}

/* ---------- Log row ---------- */
function logResult(e) {
  if (e.result === 'sent') return `<span class="inline-flex items-center gap-1 text-label-s text-success-fg">${icon('check', 'h-3.5 w-3.5')}Sent</span>`;
  if (e.result === 'error') return `<span class="inline-flex items-center gap-1 text-label-s text-danger-fg">${icon('alert', 'h-3.5 w-3.5')}Error</span>`;
  return `<span class="inline-flex items-center gap-1 text-label-s text-secondary">${icon('arrow-right', 'h-3.5 w-3.5')}Page</span>`;
}
function logCommand(e) {
  if (e.result === 'navigation') return `<span class="text-body-s text-secondary">${esc(e.from)} ${icon('arrow-right', 'inline h-3.5 w-3.5 align-[-2px] text-muted')} ${esc(e.navigateTo)} <span class="text-muted">· no command</span></span>`;
  return `<span class="text-body-s text-muted">${esc(e.target)}</span> <span class="font-mono text-mono-s text-primary">${esc(e.command)}</span>${e.args ? ` <span class="font-mono text-mono-s text-muted">${esc(e.args)}</span>` : ''}${e.error ? ` <span class="text-body-s text-danger-fg">· ${esc(e.error)}</span>` : ''}${e.navigateTo ? ` <span class="text-body-s text-muted">· ${icon('arrow-right', 'inline h-3.5 w-3.5 align-[-2px]')} ${esc(e.navigateTo)}</span>` : ''}`;
}
const logSource = (e) => e.source === 'test' ? testTag() : `<span class="text-body-s text-secondary">${esc(e.source)}</span>`;
function logRow(e, { fresh } = {}) {
  return `<tr class="${e.result === 'error' ? 'bg-danger-bg' : fresh ? 'bg-accent-subtle' : 'hover:bg-hover'}">
    <td class="whitespace-nowrap py-1 pl-4 pr-2 font-mono text-mono-s text-muted tabular">${e.time}</td>
    <td class="px-2 py-1">${logResult(e)}</td>
    <td class="px-2 py-1">${logSource(e)}</td>
    <td class="px-2 py-1 text-body-s">${esc(e.hotspot)}</td>
    <td class="px-2 py-1 pr-4">${logCommand(e)}</td></tr>`;
}

/* ---------- Command log panel (shell) ---------- */
function logPanel({ collapsed, rows = LOG } = {}) {
  if (collapsed) {
    const e = rows[0];
    return `<section aria-label="Command log" class="flex h-9 flex-none items-center gap-3 border-t bg-surface pl-2 pr-3">
      ${button({ variant: 'ghost', size: 's', icon: 'chevron-down', ariaLabel: 'Expand command log', cls: 'rotate-180' })}
      <h2 class="flex-none text-label-m">Command log</h2>
      <span class="h-4 w-px flex-none bg-pressed" aria-hidden="true"></span>
      <div class="flex min-w-0 flex-1 items-center gap-3 overflow-hidden whitespace-nowrap" aria-live="polite">
        ${e ? `<span class="font-mono text-mono-s text-muted tabular">${e.time}</span>${logResult(e)}${logSource(e)}<span class="text-body-s">${esc(e.hotspot)}</span><span class="min-w-0 truncate">${logCommand(e)}</span>` : `<span class="text-body-s text-muted">No commands yet</span>`}
      </div>
      <span class="flex-none text-body-s text-muted">${rows.length} today</span>
    </section>`;
  }
  return `<section aria-label="Command log" class="flex h-[176px] flex-none flex-col border-t bg-surface">
    <div class="flex h-9 flex-none items-center gap-3 border-b pl-2 pr-3">
      ${button({ variant: 'ghost', size: 's', icon: 'chevron-down', ariaLabel: 'Collapse command log' })}
      <h2 class="text-label-m">Command log</h2>
      <span class="inline-flex items-center gap-1.5 text-body-s text-muted"><span class="h-1.5 w-1.5 rounded-full bg-success-solid" aria-hidden="true"></span>Live from all stations</span>
      <div class="ml-auto flex items-center gap-2">${button({ variant: 'ghost', size: 's', label: 'Clear' })}</div>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto">
      <table class="w-full text-left"><caption class="sr-only">Latest commands, newest first</caption>
        <thead class="sticky top-0 bg-subtle"><tr class="text-overline uppercase text-muted">
          <th scope="col" class="w-[120px] py-1 pl-4 pr-2 font-semibold">Time</th><th scope="col" class="w-[84px] px-2 py-1 font-semibold">Result</th>
          <th scope="col" class="w-[128px] px-2 py-1 font-semibold">Source</th><th scope="col" class="w-[150px] px-2 py-1 font-semibold">Hotspot</th>
          <th scope="col" class="px-2 py-1 pr-4 font-semibold">Command</th></tr></thead>
        <tbody class="divide-y">${rows.length ? rows.map((e) => logRow(e)).join('') : `<tr><td colspan="5" class="px-4 py-6 text-center text-body-s text-muted">No commands yet. Taps from every station and test sends appear here.</td></tr>`}</tbody>
      </table>
    </div>
  </section>`;
}

/* =====================================================================
   v0.3 additions: shell and screen-level components
   ===================================================================== */

/* ---------- Toolbar meta: read-only value in a toolbar ---------- */
const toolbarMeta = (text, label) => `<span class="inline-flex h-8 flex-none items-center gap-1.5 rounded bg-subtle px-2.5 text-body-s text-secondary"${label ? ` aria-label="${esc(label)}"` : ''}><span class="tabular">${text}</span></span>`;

/* ---------- Editor shell: top bar, body, command log, optional modal ---------- */
function shell({ tab, body, collapsed, save = 'saved', conn = 'connected', demo, logRows = LOG, modal = '', banner: shellBanner = '' }) {
  return `<div class="relative flex h-[900px] w-[1440px] flex-col overflow-hidden bg-app text-primary">
    ${topBar({ tab, save: demo ? null : save, conn, demo })}${shellBanner}
    <div class="flex min-h-0 flex-1">${body}</div>
    ${logPanel({ collapsed, rows: logRows })}
    ${modal ? `<div class="absolute inset-0 z-20 flex items-center justify-center bg-scrim">${modal}</div>` : ''}
  </div>`;
}

/* ---------- List panel (left column of Targets / Stations) ---------- */
function textRow({ title, meta, selected, warn }) {
  return `<li><button type="button" ${selected ? 'aria-current="true"' : ''} class="block w-full rounded border px-3 py-2 text-left ${selected ? 'border-selection bg-selection' : 'border-transparent hover:bg-hover'}">
    <span class="flex items-center gap-1.5 text-label-m">${esc(title)}${warn ? `${icon('alert', 'h-3.5 w-3.5 text-danger-fg')}<span class="sr-only">has invalid fields</span>` : ''}</span>
    <span class="block truncate text-body-s ${selected ? 'text-secondary' : 'text-muted'}">${meta}</span></button></li>`;
}
function listPanel({ title, items, addLabel, empty }) {
  return `<aside aria-label="${esc(title)}" class="flex w-[264px] flex-none flex-col border-r bg-surface">
    <div class="flex h-11 flex-none items-center justify-between border-b pl-4 pr-2">
      <h2 class="text-label-m">${esc(title)} <span class="text-body-s text-muted">${items.length}</span></h2>
      ${button({ variant: 'ghost', size: 's', icon: 'plus', label: addLabel })}
    </div>
    ${items.length ? `<ul class="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">${items.map(textRow).join('')}</ul>` : `<p class="p-4 text-body-s text-muted">${empty}</p>`}
  </aside>`;
}

/* ---------- Empty state ---------- */
function emptyState({ icon: ic, title, body, action }) {
  return `<div class="mx-auto flex max-w-[420px] flex-col items-center gap-3 text-center">
    <span class="flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent-strong">${icon(ic, 'h-6 w-6')}</span>
    <h2 class="text-heading-l">${title}</h2><p class="text-body-m text-secondary">${body}</p>${action ? `<div class="pt-1">${action}</div>` : ''}</div>`;
}

/* ---------- Form card (main column of Targets / Stations / Settings) ---------- */
function formCard({ title, action = '', body, id }) {
  return `<section ${id ? `id="${id}"` : ''} class="rounded-lg border bg-surface" aria-label="${esc(title)}">
    <div class="flex h-12 items-center justify-between border-b px-5"><h2 class="text-heading-m">${title}</h2>${action}</div>
    <div class="space-y-5 p-5">${body}</div></section>`;
}

/* ---------- Dialog ---------- */
function dialog({ tone = 'default', title, body, confirmLabel, cancelLabel = 'Cancel', confirmIcon }) {
  const danger = tone === 'danger';
  return `<div role="${danger ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-label="${esc(title.replace(/<[^>]+>/g, ''))}" class="w-[440px] rounded-xl bg-surface p-6 shadow-3">
    <div class="flex gap-4">${danger ? `<span class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-danger-bg text-danger-fg" aria-hidden="true">${icon('trash')}</span>` : ''}
      <div class="min-w-0"><h2 class="text-heading-m">${title}</h2><div class="mt-2 space-y-2 text-body-m text-secondary">${body}</div></div></div>
    <div class="mt-6 flex justify-end gap-2">${button({ label: cancelLabel, cls: danger ? 'is-focus' : '' })}${button({ variant: danger ? 'danger' : 'primary', label: confirmLabel, icon: confirmIcon })}</div>
  </div>`;
}

/* ---------- QR card ---------- */
function qrCard({ url, qr, copied, disabled }) {
  const plate = disabled
    ? `<div class="mx-auto my-4 flex aspect-square w-[176px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-strong bg-subtle p-3 text-center">${icon('alert', 'text-muted')}<span class="text-body-s text-secondary">Fix the id to show a QR code</span></div>`
    : `<div class="mx-auto my-4 w-[176px] rounded-lg bg-overlay-light p-3 text-overlay-dark">${qr}</div>`;
  const copy = copied
    ? `<button type="button" class="inline-flex h-8 items-center justify-center gap-2 rounded border border-success bg-success-bg px-3 text-label-m text-success-fg">${icon('check')}Copied</button>`
    : button({ icon: 'copy', label: 'Copy', disabled, cls: 'justify-center' });
  return `<div class="w-[288px] rounded-xl border bg-surface p-5 shadow-1">
    <p class="text-overline uppercase text-muted">Station URL</p>${plate}
    <p class="break-all font-mono text-mono-s ${disabled ? 'text-disabled' : copied ? 'rounded-sm bg-selection text-primary' : 'text-primary'}">${esc(url)}</p>
    <div class="mt-4 grid grid-cols-2 gap-2">${copy}${button({ icon: 'external', label: 'Open', disabled, cls: 'justify-center' })}</div>
    ${copied ? `<p class="mt-2 text-body-s text-muted" role="status">URL copied to the clipboard.</p>` : ''}
  </div>`;
}

/* ---------- Scale diagram (Settings): the 4:3 page on a wider screen ----------
   Fit: dark screen, amber page inside, dark bars at the sides.
   Fill: amber page larger than the screen; the parts outside the screen outline are cropped (pale, dashed). */
function scaleDiagram({ mode, ref, width = 150 }) {
  const r = REFERENCE[ref], pw = PROJECT.canvas.w, ph = PROJECT.canvas.h;
  const k = width / r.w, sh = Math.round(r.h * k);
  const s = mode === 'fit' ? Math.min(r.w / pw, r.h / ph) : Math.max(r.w / pw, r.h / ph);
  const w = Math.round(pw * s * k), h = Math.round(ph * s * k);
  let art, caption;
  if (mode === 'fit') {
    const x = Math.round((width - w) / 2);
    art = `<div class="relative rounded-sm bg-inverse" style="width:${width}px;height:${sh}px">
      <div class="absolute flex items-center justify-center bg-accent text-label-s text-on-accent" style="left:${x}px;top:0;width:${w}px;height:${h}px">Page</div></div>`;
    caption = `${Math.round((r.w - pw * s) / 2)} px bars left and right`;
  } else {
    const y = Math.round((h - sh) / 2);
    art = `<div class="relative" style="width:${width}px;height:${h}px">
      <div class="absolute inset-0 rounded-sm border border-dashed border-strong bg-accent-subtle"></div>
      <div class="absolute flex items-center justify-center bg-accent text-label-s text-on-accent outline outline-2 outline-[color:var(--color-bg-inverse)]" style="left:0;top:${y}px;width:${width}px;height:${sh}px">Page</div></div>`;
    caption = `${Math.round((ph * s - r.h) / 2)} px cropped top and bottom`;
  }
  return `<figure class="flex flex-col items-center gap-2"><div class="flex items-center" style="min-height:${Math.round(width * 0.75)}px">${art}</div>
    <figcaption class="text-center"><span class="block text-label-s">${r.label}</span><span class="block text-body-s text-muted tabular">${caption}</span></figcaption></figure>`;
}

/* ---------- Screen tile (demo receiver) ---------- */
function screenTile({ name, content, since, source, fresh }) {
  return `<section aria-label="${esc(name)}" class="flex flex-col rounded-lg border bg-surface p-3 ${fresh ? 'border-selection shadow-[0_0_0_3px_var(--color-accent-subtle)]' : ''}">
    <div class="mb-2 flex items-center justify-between"><h2 class="text-label-m">${esc(name)}</h2>
      ${fresh ? `<span class="inline-flex h-5 items-center gap-1 rounded-sm bg-accent px-1.5 text-label-s text-on-accent">Just changed</span>` : `<span class="text-body-s text-muted">Playing</span>`}</div>
    <div class="flex aspect-video items-center justify-center rounded bg-inverse px-3 ${fresh ? 'ring-2 ring-[color:var(--color-accent-default)] ring-offset-2 ring-offset-[color:var(--color-bg-surface)]' : ''}">
      <span class="truncate font-mono text-heading-l font-normal text-inverse" aria-live="polite">${esc(content)}</span></div>
    <p class="mt-2 text-body-s text-muted">Since <span class="font-mono text-mono-s">${since}</span> · ${esc(source)}</p>
  </section>`;
}

/* ---------- Compact row: a one-line link/button row in a list ---------- */
function compactRow({ lead = '', title, meta = '', trailing = '', mono: m }) {
  return `<li><button type="button" class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-hover">${lead}
    <span class="min-w-0 flex-1 truncate ${m ? 'font-mono text-mono-s' : 'text-label-m'}">${title}</span>${meta ? `<span class="flex-none text-body-s text-muted">${meta}</span>` : ''}${trailing}</button></li>`;
}
/* ---------- Log row, compact (two lines, for side panels) ---------- */
function logRowCompact(e) {
  return `<li class="space-y-0.5 px-5 py-2.5"><div class="flex items-center gap-2"><span class="font-mono text-mono-s text-muted tabular">${e.time}</span>${logResult(e)}${logSource(e)}</div>
    <p class="truncate"><span class="font-mono text-mono-s">${esc(e.command || '')}</span> <span class="font-mono text-mono-s text-muted">${esc(e.args || '')}</span></p></li>`;
}
/* ---------- Shell banner: full-width strip under the top bar ---------- */
function shellBanner({ tone = 'warning', title, body, action = '' }) {
  const T = { warning: ['border-warning bg-warning-bg text-warning-fg', 'alert', 'text-warning-solid'], error: ['border-danger bg-danger-bg text-danger-fg', 'alert', 'text-danger-fg'], info: ['border-info bg-info-bg text-info-fg', 'info', 'text-info-solid'] }[tone];
  return `<div role="${tone === 'error' ? 'alert' : 'status'}" class="flex h-10 flex-none items-center gap-2 border-b px-4 text-body-m ${T[0]}">${icon(T[1], T[2])}<span class="font-semibold">${title}</span><span class="min-w-0 flex-1 truncate">${body}</span>${action}</div>`;
}
/* ---------- Skeleton ---------- */
const skeleton = (cls, style = '') => `<span class="skeleton block ${cls}" ${style ? `style="${style}"` : ''} aria-hidden="true"></span>`;
