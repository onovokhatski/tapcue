// Segmented control of the design system (components.md: Segmented control; prototype segmented()):
// two or three fixed options, one chosen, or none when several hotspots differ (spec ED-19). A radio
// group: Tab enters it, the arrow keys choose.
import { type KeyboardEvent, useRef } from 'react';

interface SegmentedProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  /** null: no option is chosen, e.g. "Mixed". */
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]!.value);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex flex-none rounded p-0.5 ${disabled ? 'bg-disabled' : 'bg-pressed'}`}
    >
      {options.map((option, index) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            // Only the chosen option is in the Tab order (a radio group's usual keyboard model);
            // with none chosen, the first one.
            tabIndex={on || (value === null && index === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`h-6 rounded-sm px-2.5 text-label-s ${
              on
                ? 'bg-surface text-primary shadow-1'
                : disabled
                  ? 'text-disabled'
                  : 'text-secondary hover:text-primary'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
