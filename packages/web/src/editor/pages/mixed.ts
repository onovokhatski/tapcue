// Several hotspots shown in one panel (spec ED-19): a setting they all share shows its value, one
// whose values differ shows as "Mixed".

export const MIXED = Symbol('mixed');
export type Shared<T> = T | typeof MIXED;

/** The value every item has, or MIXED; values are compared by content. None at all is MIXED too. */
export function shared<T>(values: T[]): Shared<T> {
  if (values.length === 0) return MIXED;
  const [first] = values as [T, ...T[]];
  const key = JSON.stringify(first);
  return values.every((value) => JSON.stringify(value) === key) ? first : MIXED;
}

/** A shared number as the text of its field; empty when mixed, so the field shows "Mixed". */
export function sharedText<T>(value: Shared<T>, show: (value: T) => string): string {
  return value === MIXED ? '' : show(value);
}
