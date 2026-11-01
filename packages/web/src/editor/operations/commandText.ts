// Commands as the editor shows and checks them: protocol names, OSC argument values, UDP text with
// its line endings written as \r and \n (spec TGT-2, ED-10).
import type { OscArgument, Target } from '@tapcue/shared';

export const PROTOCOL_LABEL: Record<Target['protocol'], string> = {
  'osc-udp': 'OSC over UDP',
  udp: 'UDP',
  http: 'HTTP',
};

/** An argument of another type, keeping its value where it can (1.7 → 2, 2 → "2", "x" → 0). */
export function convertArgument(argument: OscArgument, type: OscArgument['type']): OscArgument {
  const asNumber = typeof argument.value === 'number' ? argument.value : Number(argument.value);
  const number = Number.isFinite(asNumber) ? asNumber : 0;
  if (type === 's') return { type, value: String(argument.value) };
  if (type === 'i') return { type, value: Math.round(number) };
  return { type, value: number };
}

const INT32 = 2 ** 31;

export function checkArgument(type: OscArgument['type'], text: string): string | null {
  if (type === 's') return null;
  const trimmed = text.trim();
  if (type === 'i') {
    if (!/^-?\d+$/.test(trimmed)) return 'Expected a whole number';
    const value = Number(trimmed);
    return value < -INT32 || value > INT32 - 1 ? 'Expected a 32-bit whole number' : null;
  }
  return trimmed === '' || !Number.isFinite(Number(trimmed)) ? 'Expected a number' : null;
}

export function parseArgument(type: OscArgument['type'], text: string): OscArgument {
  return type === 's' ? { type, value: text } : { type, value: Number(text.trim()) };
}

/** Line endings are shown as \r and \n, so they can be typed in one line (design: UDP text). */
export const showControls = (text: string) => text.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
export const readControls = (text: string) => text.replace(/\\r/g, '\r').replace(/\\n/g, '\n');
