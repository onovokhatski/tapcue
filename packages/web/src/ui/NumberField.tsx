// Number field of the design system (components.md: Number field; prototype numberField()): an
// optional short prefix such as X, the value right-aligned, an optional unit, error and disabled.
interface NumberFieldProps {
  prefix?: string;
  suffix?: string;
  ariaLabel: string;
  value: string;
  error?: boolean;
  disabled?: boolean;
  onChange: (text: string) => void;
  onBlur?: () => void;
}

export function NumberField({
  prefix,
  suffix,
  ariaLabel,
  value,
  error,
  disabled = false,
  onChange,
  onBlur,
}: NumberFieldProps) {
  const state = disabled
    ? 'cursor-not-allowed border-default bg-disabled'
    : error
      ? 'field field-error bg-surface'
      : 'field border-strong bg-surface';
  return (
    <label className={`flex h-7 min-w-0 items-center gap-1.5 rounded border px-2 ${state}`}>
      {prefix && (
        <span className={`text-label-s ${disabled ? 'text-disabled' : 'text-muted'}`}>
          {prefix}
        </span>
      )}
      <input
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        inputMode="numeric"
        disabled={disabled}
        className={`w-full min-w-0 bg-transparent text-right text-body-m tabular-nums outline-none ${
          disabled ? 'text-disabled' : ''
        }`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {suffix && <span className="text-body-s text-muted">{suffix}</span>}
    </label>
  );
}
