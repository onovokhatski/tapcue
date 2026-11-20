import { describe, expect, it } from 'vitest';
import { faderRatio, faderValueAt, snapFaderValue } from './fader';
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
