// Text field of the design system (components.md: Text field; prototype textField()): a label, the
// value, a helper that an error replaces. Mono for anything a machine reads: address, host, URL,
// path, UDP text.
import { useId } from 'react';
import { Icon } from './Icon';

interface TextFieldProps {
  /** Shown above the field; without it, `ariaLabel` names the field. */
  label?: string;
  ariaLabel?: string;
  value: string;
  onChange: (text: string) => void;
  onBlur?: () => void;
  onEnter?: () => void;
  helper?: string;
  /** Replaces the helper and marks the field invalid. */
  error?: string | null;
  placeholder?: string;
  mono?: boolean;
  multiline?: boolean;
  rows?: number;
  /** A fixed part before the value, e.g. a base URL before an HTTP path. */
  prefix?: string;
  size?: 'm' | 's';
  maxLength?: number;
  disabled?: boolean;
}

export function TextField({
  label,
  ariaLabel,
  value,
  onChange,
  onBlur,
  onEnter,
  helper,
  error,
  placeholder,
  mono = false,
  multiline = false,
  rows = 3,
  prefix,
  size = 'm',
  maxLength,
  disabled = false,
}: TextFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const font = mono ? 'font-mono text-mono-m' : 'text-body-m';
  const height = size === 's' ? 'h-7' : 'h-8';
  const state = disabled
    ? 'cursor-not-allowed border-default bg-disabled text-disabled'
    : error
      ? 'field field-error bg-surface'
      : 'field border-strong bg-surface';
  const shared = {
    id,
    value,
    disabled,
    placeholder,
    maxLength,
    'aria-label': label ? undefined : ariaLabel,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error || helper ? messageId : undefined,
    onBlur,
  };

  let control;
  if (multiline) {
    control = (
      <textarea
        {...shared}
        rows={rows}
        className={`block w-full resize-y rounded border px-3 py-1.5 placeholder:text-muted ${font} ${state}`}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  } else {
    const input = (
      <input
        {...shared}
        className={
          prefix
            ? `h-full w-full min-w-0 bg-transparent px-2 outline-none ${font}`
            : `${height} w-full min-w-0 rounded border px-3 placeholder:text-muted ${font} ${state}`
        }
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onEnter?.();
        }}
      />
    );
    control = prefix ? (
      <div className={`flex ${height} min-w-0 items-center rounded border ${state}`}>
        <span className="flex-none border-r border-default px-2 font-mono text-mono-s text-muted select-none">
          {prefix}
        </span>
        {input}
      </div>
    ) : (
      input
    );
  }

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
      {control}
      {error ? (
        <p id={messageId} className="flex items-start gap-1 text-body-s text-danger-fg">
          <Icon name="alert" className="mt-px h-3.5 w-3.5" />
          <span>{error}</span>
        </p>
      ) : (
        helper && (
          <p id={messageId} className="text-body-s text-muted">
            {helper}
          </p>
        )
      )}
    </div>
  );
}
