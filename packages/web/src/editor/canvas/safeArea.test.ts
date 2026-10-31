import type { Canvas } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { cropBands, croppedBy } from './safeArea';

const fill: Canvas = { width: 2048, height: 1536, scaleMode: 'fill', backgroundColor: '#000000' };
const fit: Canvas = { ...fill, scaleMode: 'fit' };
const box = (x: number, y: number, width = 200, height = 200) => ({ x, y, width, height });

describe('cropBands (spec ED-3)', () => {
  it('crops top and bottom of a 4:3 page on wider screens', () => {
    // 16:10: scale 1280 / 2048 = 0.625, 800 / 0.625 = 1280 of 1536 rows visible.
    expect(cropBands(fill, '16:10')).toEqual({ side: 0, top: 128 });
    // 16:9: scale 1920 / 2048 = 0.9375, 1080 / 0.9375 = 1152 rows visible.
    expect(cropBands(fill, '16:9')).toEqual({ side: 0, top: 192 });
  });

  it('crops the sides of a page wider than the screen', () => {
    const wide = { ...fill, width: 1920, height: 1080 };
    // 16:10: scale 800 / 1080, 1280 / scale = 1728 of 1920 columns visible.
    expect(cropBands(wide, '16:10')).toEqual({ side: 96, top: 0 });
    expect(cropBands(wide, '16:9')).toEqual({ side: 0, top: 0 });
  });

  it('crops nothing in fit', () => {
    expect(cropBands(fit, '16:10')).toEqual({ side: 0, top: 0 });
  });
});

describe('croppedBy', () => {
  it('is null for a hotspot inside the safe area, touching its edge', () => {
    expect(croppedBy(box(500, 128), fill, '16:10')).toBeNull();
    expect(croppedBy(box(500, 1208), fill, '16:10')).toBeNull(); // ends at 1408 = 1536 - 128
  });

  it('says how far a hotspot reaches into a band, and which', () => {
    expect(croppedBy(box(500, 108), fill, '16:10')).toEqual({ pixels: 20, edge: 'top' });
    expect(croppedBy(box(500, 1250), fill, '16:10')).toEqual({ pixels: 42, edge: 'bottom' });
  });

  it('reports the worst edge of a hotspot reaching into two bands', () => {
    // 28 px into the top band, 92 px into the bottom one (ends at 1500, the band starts at 1408).
    expect(croppedBy(box(0, 100, 200, 1400), fill, '16:10')).toEqual({
      pixels: 92,
      edge: 'bottom',
    });
  });

  it('depends on the reference screen', () => {
    expect(croppedBy(box(500, 150), fill, '16:10')).toBeNull();
    expect(croppedBy(box(500, 150), fill, '16:9')).toEqual({ pixels: 42, edge: 'top' });
  });

  it('flags the sides of a wide page', () => {
    const wide = { ...fill, width: 1920, height: 1080 };
    expect(croppedBy(box(10, 400), wide, '16:10')).toEqual({ pixels: 86, edge: 'left' });
    expect(croppedBy(box(1800, 400, 100), wide, '16:10')).toEqual({ pixels: 76, edge: 'right' });
  });

  it('is null for every hotspot in fit', () => {
    expect(croppedBy(box(0, 0), fit, '16:10')).toBeNull();
  });
});
