import { type Project, validateProject } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { checkCanvasSize, updateCanvas } from './canvas';

const expectValid = (project: Project) =>
  expect(validateProject(project)).toMatchObject({ ok: true });

// The demo canvas is 2048 × 1536. Furthest right: "Product C card" on Home (1344 + 560 = 1904);
// furthest down: "About" on Home (1244 + 144 = 1388).
describe('canvas operations (spec CNV-1, CNV-2)', () => {
  it('changes the size, scale mode and background colour', () => {
    const project = updateCanvas(demoProject(), {
      width: 1920,
      height: 1400,
      scaleMode: 'fill',
      backgroundColor: '#112233',
    });
    expect(project.canvas).toEqual({
      width: 1920,
      height: 1400,
      scaleMode: 'fill',
      backgroundColor: '#112233',
    });
    expectValid(project);
  });

  it('accepts a size that ends exactly at the furthest hotspot edge', () => {
    const project = updateCanvas(demoProject(), { width: 1904, height: 1388 });
    expect(project.canvas).toMatchObject({ width: 1904, height: 1388 });
    expectValid(project);
  });

  it('refuses a size that would leave a hotspot outside, and moves nothing (ED-10)', () => {
    const before = demoProject();
    expect(updateCanvas(before, { width: 1903 })).toBe(before);
    expect(updateCanvas(before, { height: 1387 })).toBe(before);
  });

  it('returns the same project when nothing changes', () => {
    const before = demoProject();
    expect(updateCanvas(before, { scaleMode: 'fit' })).toBe(before);
  });
});

describe('checkCanvasSize (spec ED-10)', () => {
  it('names the hotspot that reaches furthest, its page and the smallest size that fits', () => {
    expect(checkCanvasSize(demoProject(), 'width', 1000)).toBe(
      '“Product C card” on Home would be outside. Expected at least 1904 px, or move the hotspot first',
    );
    expect(checkCanvasSize(demoProject(), 'height', 1000)).toBe(
      '“About” on Home would be outside. Expected at least 1388 px, or move the hotspot first',
    );
  });

  it('describes a hotspot without a name', () => {
    const project = demoProject();
    project.pages[0]!.hotspots[3]!.name = ''; // "About" on Home
    expect(checkCanvasSize(project, 'height', 1000)).toBe(
      'An unnamed hotspot on Home would be outside. Expected at least 1388 px, or move the hotspot first',
    );
  });

  it('rounds a fractional edge up', () => {
    const project = demoProject();
    project.pages[0]!.hotspots[2]!.x = 1344.2;
    expect(checkCanvasSize(project, 'width', 1904)).toMatch(/at least 1905 px/);
  });

  it('refuses sizes outside the project format', () => {
    expect(checkCanvasSize(demoProject(), 'width', 8193)).toBe('Expected 1 to 8192 px');
    expect(checkCanvasSize(demoProject(), 'width', 0)).toBe('Expected 1 to 8192 px');
    expect(checkCanvasSize(demoProject(), 'width', 1904.5)).toBe(
      'Expected a whole number of pixels',
    );
    expect(checkCanvasSize(demoProject(), 'width', 8192)).toBeNull();
  });
});
