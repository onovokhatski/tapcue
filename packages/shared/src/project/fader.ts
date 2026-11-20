// Fader arithmetic shared by the player and the server (spec FD-2, ADR 0020), so a value is put on
// the grid the same way where it is dragged and where it is sent.
import type { FaderSettings } from './pages';

/** A value on the fader's grid: snapped to the step counted from min, within the range. */
export function snapFaderValue(value: number, { min, max, step }: FaderSettings): number {
  const steps = Math.round((Math.min(max, Math.max(min, value)) - min) / step);
  // Rounded to 10 decimals, so 0.1 + 0.2 is stored as 0.3, not 0.30000000000000004.
  return Math.min(max, Number((min + steps * step).toFixed(10)));
}

/** Where a value sits along the fader, from 0 (min) to 1 (max). */
export function faderRatio(value: number, { min, max }: FaderSettings): number {
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/**
 * The value at a point on the fader, for its box on screen: bottom is min on a vertical fader,
 * left on a horizontal one. A point outside the box counts as its nearest edge.
 */
export function faderValueAt(
  point: { x: number; y: number },
  box: { left: number; top: number; width: number; height: number },
  settings: FaderSettings,
): number {
  const ratio =
    settings.orientation === 'vertical'
      ? (box.top + box.height - point.y) / box.height
      : (point.x - box.left) / box.width;
  const clamped = Math.min(1, Math.max(0, ratio));
  return snapFaderValue(settings.min + clamped * (settings.max - settings.min), settings);
}

/** Where a fader's value goes in UDP text and in an HTTP path or body (ADR 0020). */
export const VALUE_PLACEHOLDER = '{value}';

/**
 * A value as text, for UDP and HTTP: a whole number when the grid has only whole numbers (whole
 * step and min), otherwise up to 3 decimals without trailing zeros: 1, 0.75, 0.333.
 */
export function formatFaderValue(value: number, { min, step }: FaderSettings): string {
  const decimals = Number.isInteger(step) && Number.isInteger(min) ? 0 : 3;
  // Through Number, so 0.750 reads 0.75 and -0.000 reads 0.
  return String(Number(value.toFixed(decimals)));
}

/** Replaces every placeholder in a text with the value. */
export function fillValue(text: string, value: string): string {
  return text.replaceAll(VALUE_PLACEHOLDER, value);
}
