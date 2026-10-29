import { describe, expect, it } from 'vitest';
import { stageGeometry } from './geometry';

const canvas = { width: 2048, height: 1536 }; // 4:3, the demo stand

describe('stageGeometry', () => {
  it('scales an equal aspect ratio exactly, with no bars and no crop in either mode', () => {
    const viewport = { width: 1024, height: 768 };
    const expected = { scale: 0.5, offsetX: 0, offsetY: 0, cropX: 0, cropY: 0 };
    expect(stageGeometry(canvas, viewport, 'fit')).toEqual(expected);
    expect(stageGeometry(canvas, viewport, 'fill')).toEqual(expected);
  });

  describe('a wider viewport: 2048 × 1536 on 1280 × 800', () => {
    const viewport = { width: 1280, height: 800 };

    it('fit: matches the height and centres the page between side bars', () => {
      const g = stageGeometry(canvas, viewport, 'fit');
      expect(g.scale).toBeCloseTo(800 / 1536); // 0.5208…
      expect(g.offsetX).toBeCloseTo(320 / 3); // (1280 − 1066.67) / 2 = 106.67
      expect(g.offsetY).toBe(0);
      expect(g.cropX).toBe(0);
      expect(g.cropY).toBe(0);
    });

    it('fill: matches the width and crops 128 canvas px at the top and bottom', () => {
      expect(stageGeometry(canvas, viewport, 'fill')).toEqual({
        scale: 0.625,
        offsetX: 0,
        offsetY: -80, // (800 − 960) / 2
        cropX: 0,
        cropY: 128, // 80 viewport px / 0.625
      });
    });
  });

  describe('a taller viewport: 2048 × 1536 on 768 × 1024 (portrait)', () => {
    const viewport = { width: 768, height: 1024 };

    it('fit: matches the width and centres the page between top and bottom bars', () => {
      expect(stageGeometry(canvas, viewport, 'fit')).toEqual({
        scale: 0.375,
        offsetX: 0,
        offsetY: 224, // (1024 − 576) / 2
        cropX: 0,
        cropY: 0,
      });
    });

    it('fill: matches the height and crops 448 canvas px on the left and right', () => {
      const g = stageGeometry(canvas, viewport, 'fill');
      expect(g.scale).toBeCloseTo(1024 / 1536); // 0.6667
      expect(g.offsetX).toBeCloseTo(-298.67, 2); // (768 − 1365.33) / 2
      expect(g.offsetY).toBe(0);
      expect(g.cropX).toBeCloseTo(448); // (2048 − 1152) / 2
      expect(g.cropY).toBe(0);
    });
  });

  it('scales up when the viewport is larger than the canvas', () => {
    const g = stageGeometry({ width: 1024, height: 768 }, { width: 2048, height: 1536 }, 'fit');
    expect(g.scale).toBe(2);
  });

  it('draws nothing in an empty viewport (before layout) instead of dividing by zero', () => {
    const empty = { scale: 0, offsetX: 0, offsetY: 0, cropX: 0, cropY: 0 };
    expect(stageGeometry(canvas, { width: 0, height: 0 }, 'fill')).toEqual(empty);
    expect(stageGeometry(canvas, { width: 1280, height: 0 }, 'fit')).toEqual(empty);
  });
});
