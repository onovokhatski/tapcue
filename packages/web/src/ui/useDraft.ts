// A form field's text while it is edited (spec ED-10): a valid value applies at once; an invalid one
// stays in the field with its reason and changes nothing until it is fixed. When the field is not
// being edited it shows the saved value, so it follows changes made elsewhere.
import { useState } from 'react';

export interface Draft {
  text: string;
  error: string | null;
  onChange: (text: string) => void;
  onBlur: () => void;
}

/**
 * `value` is the saved value as text; `check` says why a text cannot be used (or null);
 * `apply` saves a text that passed the check.
 */
export function useDraft(
  value: string,
  check: (text: string) => string | null,
  apply: (text: string) => void,
): Draft {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;
  const error = draft === null ? null : check(draft);
  return {
    text,
    error,
    onChange: (next) => {
      setDraft(next);
      if (!check(next)) apply(next);
    },
    // A valid field goes back to showing the saved value; an invalid one keeps its text and error.
    onBlur: () => {
      if (draft !== null && !check(draft)) setDraft(null);
    },
  };
}
