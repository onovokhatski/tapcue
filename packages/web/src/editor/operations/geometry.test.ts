import { describe, expect, it } from 'vitest';
import {
  boundingBox,
  boxFieldLimits,
  checkBoxField,
  type Handle,
  MIN_SIZE,
  moveGroup,
  moveRect,
  overlaps,
  rectBetween,
  resizeRect,
} from './geometry';

const canvas = { width: 2048, height: 1536 };
const box = { x: 100, y: 200, width: 300, height: 400 };

describe('moveRect', () => {
  it('moves by whole canvas pixels', () => {
    expect(moveRect(box, 10.4, -20.6, canvas)).toEqual({ ...box, x: 110, y: 179 });
  });

  it('returns only the box, whatever else the object it is given carries', () => {
    const hotspot = { ...box, id: 'h_carda0', name: 'Card' };
    expect(Object.keys(moveRect(hotspot, 1, 1, canvas)).sort()).toEqual([
      'height',
      'width',
      'x',
      'y',
    ]);
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

describe('boxFieldLimits', () => {
  it.each([
    ['x', { min: 0, max: 1748 }], // 2048 - 300
    ['y', { min: 0, max: 1136 }], // 1536 - 400
    ['width', { min: 1, max: 1948 }], // 2048 - 100
    ['height', { min: 1, max: 1336 }], // 1536 - 200
  ] as const)('keeps %s inside the canvas', (key, limits) => {
    expect(boxFieldLimits(key, box, canvas)).toEqual(limits);
  });
});

describe('checkBoxField (spec ED-10)', () => {
  it.each([
    ['x', '0'],
    ['x', '1748'], // 2048 - 300
    ['y', '1136'], // 1536 - 400
    ['width', '1'],
    ['width', '1948'], // 2048 - 100
    ['height', ' 1336 '],
  ] as const)('accepts %s = %s', (key, text) => {
    expect(checkBoxField(key, text, box, canvas)).toBeNull();
  });

  it.each([
    ['x', '', 'expected a whole number'],
    ['x', '12.5', 'expected a whole number'],
    ['x', '-1', 'expected a whole number'],
    ['x', 'abc', 'expected a whole number'],
    ['x', '1749', '0 to 1748, to stay inside the canvas'],
    ['width', '0', '1 to 1948, to stay inside the canvas'],
    ['height', '1337', '1 to 1336, to stay inside the canvas'],
  ] as const)('refuses %s = "%s"', (key, text, message) => {
    expect(checkBoxField(key, text, box, canvas)).toBe(message);
  });
});

describe('groups (spec ED-16)', () => {
  const a = { x: 100, y: 100, width: 200, height: 100 };
  const b = { x: 400, y: 300, width: 100, height: 300 };

  it('finds the common box of several boxes, or none', () => {
    expect(boundingBox([a, b])).toEqual({ x: 100, y: 100, width: 400, height: 500 });
    expect(boundingBox([b])).toEqual(b);
    expect(boundingBox([])).toBeNull();
  });

  it('moves boxes together by whole pixels', () => {
    expect(moveGroup({ a, b }, 10.4, -20.6, canvas)).toEqual({
      a: { ...a, x: 110, y: 79 },
      b: { ...b, x: 410, y: 279 },
    });
  });

  it('stops the group as a whole at each edge, keeping its shape', () => {
    // The common box is 400 × 500 at (100, 100): it can go 100 left and up, 1548 right, 936 down.
    expect(moveGroup({ a, b }, -500, -500, canvas)).toEqual({
      a: { ...a, x: 0, y: 0 },
      b: { ...b, x: 300, y: 200 },
    });
    expect(moveGroup({ a, b }, 5000, 5000, canvas)).toEqual({
      a: { ...a, x: 1648, y: 1036 },
      b: { ...b, x: 1948, y: 1236 },
    });
  });

  it('leaves no boxes as they are', () => {
    expect(moveGroup({}, 10, 10, canvas)).toEqual({});
  });

  it('sees boxes overlap, but not when they only touch', () => {
    expect(overlaps(a, { x: 299, y: 199, width: 10, height: 10 })).toBe(true);
    expect(overlaps(a, { x: 300, y: 150, width: 10, height: 10 })).toBe(false);
    expect(overlaps(a, { x: 150, y: 200, width: 10, height: 10 })).toBe(false);
    expect(overlaps(a, { x: 90, y: 150, width: 10, height: 10 })).toBe(false);
    expect(overlaps(a, { x: 150, y: 90, width: 10, height: 10 })).toBe(false);
    expect(overlaps(a, { x: 0, y: 0, width: 2048, height: 1536 })).toBe(true);
  });

  it('makes the box between two corners, in any order', () => {
    const box = { x: 10, y: 20, width: 90, height: 60 };
    expect(rectBetween({ x: 10, y: 20 }, { x: 100, y: 80 })).toEqual(box);
    expect(rectBetween({ x: 100, y: 80 }, { x: 10, y: 20 })).toEqual(box);
    expect(rectBetween({ x: 100, y: 20 }, { x: 10, y: 80 })).toEqual(box);
  });
});
