import { describe, expect, it } from 'vitest';
import { type Handle, MIN_SIZE, moveRect, resizeRect } from './geometry';

const canvas = { width: 2048, height: 1536 };
const box = { x: 100, y: 200, width: 300, height: 400 };

describe('moveRect', () => {
  it('moves by whole canvas pixels', () => {
    expect(moveRect(box, 10.4, -20.6, canvas)).toEqual({ ...box, x: 110, y: 179 });
  });

  it('stops at every canvas edge, keeping the size', () => {
    expect(moveRect(box, -500, -500, canvas)).toEqual({ ...box, x: 0, y: 0 });
    expect(moveRect(box, 5000, 5000, canvas)).toEqual({ ...box, x: 1748, y: 1136 });
  });
});

describe('resizeRect', () => {
  it.each<[Handle, number, number, { x: number; y: number; width: number; height: number }]>([
    ['e', 50, 99, { x: 100, y: 200, width: 350, height: 400 }],
    ['w', 50, 99, { x: 150, y: 200, width: 250, height: 400 }],
    ['s', 99, 50, { x: 100, y: 200, width: 300, height: 450 }],
    ['n', 99, 50, { x: 100, y: 250, width: 300, height: 350 }],
    ['se', 20, 30, { x: 100, y: 200, width: 320, height: 430 }],
    ['nw', 20, 30, { x: 120, y: 230, width: 280, height: 370 }],
    ['ne', 20, 30, { x: 100, y: 230, width: 320, height: 370 }],
    ['sw', 20, 30, { x: 120, y: 200, width: 280, height: 430 }],
  ])(
    'moves only the edges of the %s handle; the opposite ones stay',
    (handle, dx, dy, expected) => {
      expect(resizeRect(box, handle, dx, dy, canvas)).toEqual(expected);
    },
  );

  it('never makes the box smaller than the minimum, however far the handle goes', () => {
    expect(MIN_SIZE).toBe(16);
    expect(resizeRect(box, 'e', -1000, 0, canvas)).toEqual({ ...box, width: 16 });
    expect(resizeRect(box, 'nw', 1000, 1000, canvas)).toEqual({
      x: 384,
      y: 584,
      width: 16,
      height: 16,
    });
  });

  it('stops at the canvas border', () => {
    expect(resizeRect(box, 'nw', -1000, -1000, canvas)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 600,
    });
    expect(resizeRect(box, 'se', 5000, 5000, canvas)).toEqual({
      x: 100,
      y: 200,
      width: 1948,
      height: 1336,
    });
  });

  it('rounds to whole pixels', () => {
    expect(resizeRect(box, 'se', 0.6, 0.4, canvas)).toEqual({ ...box, width: 301, height: 400 });
  });
});
