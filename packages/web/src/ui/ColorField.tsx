// Colour field of the design system (components.md: Colour field; prototype colorField()): a swatch
// that opens the browser's colour picker, the value as #RRGGBB, and — where a colour is optional —
// "None". A hex that is not a colour stays in the field with its error and is not saved (ED-10).
import { Icon } from './Icon';
import { useDraft } from './useDraft';

const HEX = /^#[0-9a-f]{6}$/i;

interface ColorFieldProps {
  /** Names the colour, e.g. "fill": the controls become "Pick fill", "fill hex", "Set fill to None". */
  ariaLabel: string;
  value: string | null;
  onChange: (value: string | null) => void;
  /** Whether "None" is a choice (a hotspot's fill may be none; the canvas colour may not). */
  allowNone?: boolean;
  disabled?: boolean;
}

export function checkHex(text: string): string | null {
  return HEX.test(text.trim()) ? null : 'Expected a colour like #3A7BFF';
}

export function ColorField({
  ariaLabel,
  value,
  onChange,
  allowNone = false,
  disabled = false,
}: ColorFieldProps) {
  const draft = useDraft(value ?? '', checkHex, (text) => onChange(text.trim().toUpperCase()));
  const box = `flex h-7 min-w-0 items-center gap-2 rounded border pl-1 ${
    disabled
      ? 'cursor-not-allowed border-default bg-disabled'
      : draft.error
        ? 'field field-error bg-surface'
        : 'field border-strong bg-surface'
  }`;
  // The browser's picker; it starts from the current colour, or a neutral grey for "None".
  const picker = (
    <label
      className={`relative h-5 w-5 flex-none overflow-hidden rounded-sm border border-strong ${value ? '' : 'swatch-none'}`}
      style={value ? { background: value } : undefined}
    >
      <span className="sr-only">Pick {ariaLabel}</span>
      <input
        type="color"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={(value ?? '#808080').toLowerCase()}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
    </label>
  );

  if (value === null && draft.error === null && draft.text === '') {
    return (
      <div className={`${box} pr-2`}>
        {picker}
        <span className="flex-1 text-body-m text-muted">None</span>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-1">
      <div className={`${box} pr-1`}>
        {picker}
        <input
          aria-label={`${ariaLabel} hex`}
          aria-invalid={draft.error ? true : undefined}
          className="w-full min-w-0 bg-transparent font-mono text-mono-m uppercase outline-none"
          value={draft.text}
          disabled={disabled}
          onChange={(event) => draft.onChange(event.target.value)}
          onBlur={draft.onBlur}
        />
        {allowNone && (
          <button
            type="button"
            aria-label={`Set ${ariaLabel} to None`}
            disabled={disabled}
            onClick={() => onChange(null)}
            className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-sm text-muted hover:bg-hover hover:text-primary"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {draft.error && (
        <p className="flex items-start gap-1 text-body-s text-danger-fg">
          <Icon name="alert" className="mt-px h-3.5 w-3.5" />
          <span>{draft.error}</span>
        </p>
      )}
    </div>
  );
}
