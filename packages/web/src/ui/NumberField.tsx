// Number field of the design system (components.md: Number field; prototype numberField()): an
// optional short prefix such as X, the value right-aligned, an optional unit, error and disabled.
//
// As in Figma, the prefix (or, without one, the unit) is a handle: dragging it left or right
// changes the value by one step per pixel (1 unless the field says otherwise, e.g. 0.01), ten
// with Shift. Arrow up and down in the field step it the same way. Each step goes through onChange like typed text, kept within min and max, and the end of a
// drag counts as leaving the field (onBlur).
import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

interface NumberFieldProps {
  prefix?: string;
  suffix?: string;
  ariaLabel: string;
  value: string;
  error?: boolean;
  disabled?: boolean;
  /** Limits for dragging and arrow keys; typed text is checked by the caller. */
  min?: number;
  max?: number;
  /** The size of one step for dragging and arrow keys; 1 by default. Values snap to it. */
  step?: number;
  /** Whole numbers only, or decimals too: sets the keyboard on a tablet. */
  decimal?: boolean;
  onChange: (text: string) => void;
  onBlur?: () => void;
  /** Shown while the field is empty, e.g. "Mixed" for values that differ (spec ED-19). */
  placeholder?: string;
}

/**
 * The value `steps` steps of `size` away from `text`, snapped to the step and within the limits;
 * null when text is not a number.
 */
export function stepValue(text: string, steps: number, min = -Infinity, max = Infinity, size = 1) {
  const start = Number(text.trim());
  if (text.trim() === '' || !Number.isFinite(start)) return null;
  const snapped = Math.round(start / size + steps) * size;
  // Rounded to the step's decimals, so 0.1 + 0.2 reads 0.3, not 0.30000000000000004.
  const decimals = (String(size).split('.')[1] ?? '').length;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(decimals))));
}

export function NumberField({
  prefix,
  suffix,
  ariaLabel,
  value,
  error,
  disabled = false,
  min,
  max,
  step: size = 1,
  decimal = false,
  onChange,
  onBlur,
  placeholder,
}: NumberFieldProps) {
  // The drag in progress: where the pointer went down, and the value it started from.
  const drag = useRef<{ x: number; start: string } | null>(null);

  function step(steps: number) {
    const next = stepValue(value, steps, min, max, size);
    if (next !== null && String(next) !== value) onChange(String(next));
  }

  function pointerDown(event: PointerEvent<HTMLSpanElement>) {
    if (disabled || event.button !== 0 || stepValue(value, 0) === null) return;
    event.preventDefault(); // no text selection while dragging
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, start: value };
  }

  function pointerMove(event: PointerEvent<HTMLSpanElement>) {
    if (!drag.current) return;
    const pixels = Math.round(event.clientX - drag.current.x);
    const next = stepValue(drag.current.start, pixels * (event.shiftKey ? 10 : 1), min, max, size);
    if (next !== null && String(next) !== value) onChange(String(next));
  }

  function pointerUp(event: PointerEvent<HTMLSpanElement>) {
    if (!drag.current) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onBlur?.();
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    const direction = { ArrowUp: 1, ArrowDown: -1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    step(direction * (event.shiftKey ? 10 : 1));
  }

  const state = disabled
    ? 'cursor-not-allowed border-default bg-disabled'
    : error
      ? 'field field-error bg-surface'
      : 'field border-strong bg-surface';
  const handle = disabled
    ? 'text-disabled'
    : 'cursor-ew-resize touch-none select-none text-muted hover:text-primary';
  const scrub = disabled
    ? {}
    : {
        'data-scrub': '',
        onPointerDown: pointerDown,
        onPointerMove: pointerMove,
        onPointerUp: pointerUp,
        onPointerCancel: pointerUp,
      };
  return (
    <label className={`flex h-7 min-w-0 items-center gap-1.5 rounded border px-2 ${state}`}>
      {prefix && (
        <span className={`text-label-s ${handle}`} {...scrub}>
          {prefix}
        </span>
      )}
      <input
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        inputMode={decimal ? 'decimal' : 'numeric'}
        disabled={disabled}
        className={`w-full min-w-0 bg-transparent text-right text-body-m tabular-nums ${
          disabled ? 'text-disabled' : ''
        }`}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={keyDown}
        onBlur={onBlur}
      />
      {suffix && (
        <span
          className={`text-body-s ${prefix ? 'text-muted' : handle}`}
          {...(prefix ? {} : scrub)}
        >
          {suffix}
        </span>
      )}
    </label>
  );
}
