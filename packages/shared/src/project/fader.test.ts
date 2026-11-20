import { describe, expect, it } from 'vitest';
import { faderRatio, faderValueAt, fillValue, formatFaderValue, snapFaderValue } from './fader';
import type { FaderSettings } from './pages';

const settings: FaderSettings = {
  orientation: 'vertical',
  min: 0,
  max: 1,
  step: 0.01,
  start: 0.8,
  value: { at: 0, as: 'f' },
};

describe('snapFaderValue (spec FD-2)', () => {
  it.each([
    [0.123, 0.12],
    [0.126, 0.13],
    [0.3, 0.3],
    [1, 1],
    [0, 0],
    [-0.5, 0],
    [1.5, 1],
  ])('puts %s on a 0.01 grid within 0–1 as %s', (value, expected) => {
    expect(snapFaderValue(value, settings)).toBe(expected);
  });

  it('counts steps from min and stays within max', () => {
    const odd = { ...settings, min: 1, max: 10, step: 4 };
    expect(snapFaderValue(4, odd)).toBe(5);
    expect(snapFaderValue(10, odd)).toBe(9);
    expect(snapFaderValue(2.9, odd)).toBe(1);
  });
});

describe('faderRatio', () => {
  it('places a value between min and max, kept within 0–1', () => {
    const range = { ...settings, min: -10, max: 10 };
    expect([-10, 0, 5, 10, 20].map((v) => faderRatio(v, range))).toEqual([0, 0.5, 0.75, 1, 1]);
  });
});

describe('faderValueAt (spec FD-2)', () => {
  const box = { left: 100, top: 200, width: 50, height: 400 };

  it('reads a vertical fader from the bottom (min) to the top (max)', () => {
    expect(faderValueAt({ x: 125, y: 600 }, box, settings)).toBe(0);
    expect(faderValueAt({ x: 125, y: 400 }, box, settings)).toBe(0.5);
    expect(faderValueAt({ x: 125, y: 200 }, box, settings)).toBe(1);
    expect(faderValueAt({ x: 125, y: 499 }, box, settings)).toBe(0.25);
  });

  it('reads a horizontal fader from the left (min) to the right (max)', () => {
    const wide = { left: 100, top: 200, width: 400, height: 50 };
    const horizontal = {
      ...settings,
      orientation: 'horizontal' as const,
      min: 0,
      max: 100,
      step: 1,
    };
    expect(faderValueAt({ x: 100, y: 225 }, wide, horizontal)).toBe(0);
    expect(faderValueAt({ x: 300, y: 225 }, wide, horizontal)).toBe(50);
    expect(faderValueAt({ x: 500, y: 225 }, wide, horizontal)).toBe(100);
  });

  it('counts a point past either end as that end', () => {
    expect(faderValueAt({ x: 125, y: 900 }, box, settings)).toBe(0);
    expect(faderValueAt({ x: 125, y: 0 }, box, settings)).toBe(1);
  });
});

describe('formatFaderValue (ADR 0020)', () => {
  it.each([
    [0.75, settings, '0.75'],
    [1, settings, '1'],
    [0, settings, '0'],
    [1 / 3, { ...settings, step: 0.001 }, '0.333'],
    [0.30000000000000004, settings, '0.3'],
    [-0.5, { ...settings, min: -1 }, '-0.5'],
    [127, { ...settings, max: 255, step: 1 }, '127'],
    [127.6, { ...settings, max: 255, step: 1 }, '128'],
  ])('writes %s as %s', (value, fader, text) => {
    expect(formatFaderValue(value, fader)).toBe(text);
  });

  it('keeps decimals when the step is whole but min is not, since the values are not whole', () => {
    expect(formatFaderValue(1.5, { ...settings, min: 0.5, max: 10.5, step: 1 })).toBe('1.5');
  });
});

describe('fillValue', () => {
  it('replaces every {value}, and leaves a text without one as it is', () => {
    expect(fillValue('{"l": {value}, "r": {value}}', '0.5')).toBe('{"l": 0.5, "r": 0.5}');
    expect(fillValue('GO', '0.5')).toBe('GO');
  });
});
