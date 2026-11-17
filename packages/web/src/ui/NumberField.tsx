// Number field of the design system (components.md: Number field; prototype numberField()): an
// optional short prefix such as X, the value right-aligned, an optional unit, error and disabled.
//
// As in Figma, the prefix (or, without one, the unit) is a handle: dragging it left or right
// changes the value by 1 per pixel, 10 with Shift. Arrow up and down in the field step it the same
// way. Each step goes through onChange like typed text, kept within min and max, and the end of a
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
  onChange: (text: string) => void;
  onBlur?: () => void;
}

/** The value `steps` steps away from `text`, within the limits; null when text is not a number. */
export function stepValue(text: string, steps: number, min = -Infinity, max = Infinity) {
  const start = Number(text.trim());
  if (text.trim() === '' || !Number.isFinite(start)) return null;
  return Math.min(max, Math.max(min, Math.round(start + steps)));
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
  onChange,
  onBlur,
}: NumberFieldProps) {
  // The drag in progress: where the pointer went down, and the value it started from.
  const drag = useRef<{ x: number; start: string } | null>(null);

  function step(steps: number) {
    const next = stepValue(value, steps, min, max);
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
    const next = stepValue(drag.current.start, pixels * (event.shiftKey ? 10 : 1), min, max);
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
        inputMode="numeric"
        disabled={disabled}
        className={`w-full min-w-0 bg-transparent text-right text-body-m tabular-nums ${
          disabled ? 'text-disabled' : ''
        }`}
        value={value}
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
