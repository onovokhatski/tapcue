import { describe, expect, it } from 'vitest';
import {
  checkArgument,
  convertArgument,
  parseArgument,
  readControls,
  showControls,
} from './commandText';

describe('OSC arguments', () => {
  it.each([
    ['i', '42', null],
    ['i', '-7', null],
    ['i', '2147483647', null],
    ['i', '2147483648', 'Expected a 32-bit whole number'],
    ['i', '1.5', 'Expected a whole number'],
    ['i', '', 'Expected a whole number'],
    ['f', '0.5', null],
    ['f', '-1e3', null],
    ['f', 'abc', 'Expected a number'],
    ['f', ' ', 'Expected a number'],
    ['s', '', null],
    ['s', 'intro', null],
  ] as const)('checks %s "%s"', (type, text, expected) => {
    expect(checkArgument(type, text)).toBe(expected);
  });

  it('reads a value of its type', () => {
    expect(parseArgument('i', ' 42 ')).toEqual({ type: 'i', value: 42 });
    expect(parseArgument('f', '0.5')).toEqual({ type: 'f', value: 0.5 });
    expect(parseArgument('s', ' x ')).toEqual({ type: 's', value: ' x ' });
  });

  it('keeps the value where it can when the type changes', () => {
    expect(convertArgument({ type: 'f', value: 1.7 }, 'i')).toEqual({ type: 'i', value: 2 });
    expect(convertArgument({ type: 'i', value: 2 }, 's')).toEqual({ type: 's', value: '2' });
    expect(convertArgument({ type: 's', value: '0.25' }, 'f')).toEqual({ type: 'f', value: 0.25 });
    expect(convertArgument({ type: 's', value: 'intro' }, 'i')).toEqual({ type: 'i', value: 0 });
  });
});

describe('UDP text line endings', () => {
  it('shows CR and LF as \\r and \\n, and reads them back', () => {
    expect(showControls('%1INPT 31\r')).toBe('%1INPT 31\\r');
    expect(readControls('%1INPT 31\\r')).toBe('%1INPT 31\r');
    expect(readControls(showControls('a\r\nb'))).toBe('a\r\nb');
  });
});
