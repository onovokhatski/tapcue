import { describe, expect, it } from 'vitest';
import { errorOf } from '../test/errors';
import { Canvas } from './canvas';

const canvas = { width: 2048, height: 1536, scaleMode: 'fit', backgroundColor: '#000000' };

describe('Canvas', () => {
  it('accepts the canvas from the project format example', () => {
    expect(errorOf(Canvas, canvas)).toBeNull();
  });

  it.each([1, 8192])('accepts the size limit %i', (size) => {
    expect(errorOf(Canvas, { ...canvas, width: size, height: size })).toBeNull();
  });

  it.each([
    ['zero width', { width: 0 }, 'width: Expected at least 1 px'],
    ['a width above 8192', { width: 8193 }, 'width: Expected at most 8192 px'],
    ['a fractional height', { height: 1536.5 }, 'height: Expected a whole number of pixels'],
    ['an unknown scale mode', { scaleMode: 'stretch' }, 'scaleMode'],
    ['an invalid colour', { backgroundColor: 'black' }, 'backgroundColor'],
  ])('rejects %s', (_, change, expected) => {
    expect(errorOf(Canvas, { ...canvas, ...change })).toContain(expected);
  });

  it('rejects a canvas with a missing field', () => {
    const { scaleMode: _, ...withoutScaleMode } = canvas;
    expect(errorOf(Canvas, withoutScaleMode)).toContain('scaleMode');
  });
});
