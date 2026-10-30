import { describe, expect, it } from 'vitest';
import { encodeOsc } from './osc-encode';

/** "2f 66 6f 6f" → bytes, so expected packets read like a hex dump. */
function hex(dump: string): Uint8Array {
  return Uint8Array.from(dump.split(/\s+/).filter(Boolean), (byte) => parseInt(byte, 16));
}

describe('encodeOsc', () => {
  // The two example messages of the OSC 1.0 specification (opensoundcontrol.stanford.edu/spec-1_0.html).
  it('encodes the spec example "/oscillator/4/frequency" with the float 440.0', () => {
    expect(encodeOsc('/oscillator/4/frequency', [{ type: 'f', value: 440 }])).toEqual(
      hex(`2f 6f 73 63  69 6c 6c 61  74 6f 72 2f  34 2f 66 72
           65 71 75 65  6e 63 79 00  2c 66 00 00  43 dc 00 00`),
    );
  });

  it('encodes the spec example "/foo" with 1000, -1, "hello", 1.234 and 5.678', () => {
    const args = [
      { type: 'i', value: 1000 },
      { type: 'i', value: -1 },
      { type: 's', value: 'hello' },
      { type: 'f', value: 1.234 },
      { type: 'f', value: 5.678 },
    ] as const;
    expect(encodeOsc('/foo', args)).toEqual(
      hex(`2f 66 6f 6f  00 00 00 00  2c 69 69 73  66 66 00 00
           00 00 03 e8  ff ff ff ff  68 65 6c 6c  6f 00 00 00
           3f 9d f3 b6  40 b5 b2 2d`),
    );
  });

  it('encodes the demo stand command for Resolume', () => {
    expect(encodeOsc('/composition/columns/2/connect', [{ type: 'i', value: 1 }])).toEqual(
      hex(`2f 63 6f 6d  70 6f 73 69  74 69 6f 6e  2f 63 6f 6c
           75 6d 6e 73  2f 32 2f 63  6f 6e 6e 65  63 74 00 00
           2c 69 00 00  00 00 00 01`),
    );
  });

  it('sends a message without arguments with an empty type tag string ","', () => {
    expect(encodeOsc('/go', [])).toEqual(hex('2f 67 6f 00  2c 00 00 00'));
  });

  // A string always ends with at least one null, then nulls up to a multiple of 4 bytes.
  it.each([
    ['/', '2f 00 00 00'],
    ['/a', '2f 61 00 00'],
    ['/ab', '2f 61 62 00'],
    ['/abc', '2f 61 62 63  00 00 00 00'],
  ])('pads the address %j to a multiple of 4 bytes', (address, expected) => {
    expect(encodeOsc(address, []).subarray(0, -4)).toEqual(hex(expected));
  });

  it('pads a string argument the same way, even an empty one', () => {
    expect(encodeOsc('/s', [{ type: 's', value: '' }])).toEqual(
      hex('2f 73 00 00  2c 73 00 00  00 00 00 00'),
    );
  });

  it('encodes a string as UTF-8 and pads by bytes, not characters', () => {
    // "é" is two bytes: c3 a9.
    expect(encodeOsc('/s', [{ type: 's', value: 'café' }])).toEqual(
      hex('2f 73 00 00  2c 73 00 00  63 61 66 c3  a9 00 00 00'),
    );
  });

  it('encodes the int32 limits', () => {
    const args = [
      { type: 'i', value: 2 ** 31 - 1 },
      { type: 'i', value: -(2 ** 31) },
    ] as const;
    expect(encodeOsc('/i', args).subarray(8)).toEqual(hex('7f ff ff ff  80 00 00 00'));
  });

  it('refuses an address that does not start with "/"', () => {
    expect(() => encodeOsc('composition', [])).toThrow(
      'An OSC address must start with "/", got "composition"',
    );
  });
});
