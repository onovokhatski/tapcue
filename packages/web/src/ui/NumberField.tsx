// Number field of the design system (components.md: Number field; prototype numberField()): a short
// prefix such as X, the value right-aligned, and the error state.
interface NumberFieldProps {
  prefix: string;
  ariaLabel: string;
  value: string;
  error?: boolean;
  onChange: (text: string) => void;
  onBlur?: () => void;
}

export function NumberField({
  prefix,
  ariaLabel,
  value,
  error,
  onChange,
  onBlur,
}: NumberFieldProps) {
  return (
    <label
      className={`field flex h-7 min-w-0 items-center gap-1.5 rounded border bg-surface px-2 ${
        error ? 'field-error' : 'border-strong'
      }`}
    >
      <span className="text-label-s text-muted">{prefix}</span>
      <input
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        inputMode="numeric"
        className="w-full min-w-0 bg-transparent text-right text-body-m tabular-nums outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </label>
  );
}
