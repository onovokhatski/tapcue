// Select of the design system (components.md: Select; prototype select()) as the browser's own
// <select>: keyboard and screen readers work without extra code. For two or three fixed options,
// use the segmented control instead.
import { useId } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  ariaLabel?: string;
  value: string | null;
  options: SelectOption[];
  /** Offered first, for "none of these" (e.g. "No command"); chosen, it gives null. */
  placeholder?: string;
  onChange: (value: string | null) => void;
  helper?: string;
  size?: 'm' | 's';
  disabled?: boolean;
}

export function Select({
  label,
  ariaLabel,
  value,
  options,
  placeholder,
  onChange,
  helper,
  size = 'm',
  disabled = false,
}: SelectProps) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1">
      {label && (
        <label
          htmlFor={id}
          className={`block text-label-s ${disabled ? 'text-disabled' : 'text-secondary'}`}
        >
          {label}
        </label>
      )}
      <select
        id={id}
        aria-label={label ? undefined : ariaLabel}
        aria-describedby={helper ? `${id}-helper` : undefined}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        className={`field w-full min-w-0 rounded border pr-2 pl-3 text-body-m ${size === 's' ? 'h-7' : 'h-8'} ${
          disabled
            ? 'cursor-not-allowed border-default bg-disabled text-disabled'
            : 'border-strong bg-surface text-primary'
        }`}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helper && (
        <p id={`${id}-helper`} className="text-body-s text-muted">
          {helper}
        </p>
      )}
    </div>
  );
}
