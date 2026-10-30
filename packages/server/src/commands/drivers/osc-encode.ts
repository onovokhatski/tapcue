// Encodes one OSC 1.0 message into the bytes of a UDP datagram (spec TGT-2, ADR 0007).
// Only what Tapcue sends: an address and int32, float32 and string arguments; no bundles.
import type { OscArgument } from '@tapcue/shared';

/**
 * Layout: the address, the type tags (",ifs…"), then each argument. Strings are null-terminated
 * and padded with nulls to a multiple of 4 bytes; numbers are 4 bytes, big-endian.
 */
export function encodeOsc(address: string, args: readonly OscArgument[]): Uint8Array {
  if (!address.startsWith('/')) {
    throw new Error(`An OSC address must start with "/", got "${address}"`);
  }
  const parts = [oscString(address), oscString(`,${args.map((arg) => arg.type).join('')}`)];
  for (const arg of args) {
    parts.push(arg.type === 's' ? oscString(arg.value) : oscNumber(arg));
  }
  return concat(parts);
}

/** UTF-8 bytes, at least one null after them, and nulls up to the next multiple of 4. */
function oscString(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const padded = new Uint8Array(Math.floor(bytes.length / 4) * 4 + 4);
  padded.set(bytes);
  return padded;
}

function oscNumber(arg: Exclude<OscArgument, { type: 's' }>): Uint8Array {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  if (arg.type === 'i') view.setInt32(0, arg.value);
  else view.setFloat32(0, arg.value);
  return bytes; // DataView writes big-endian unless asked otherwise
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
