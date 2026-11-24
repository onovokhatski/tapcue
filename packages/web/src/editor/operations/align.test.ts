import { type Project, validateProject } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import {
  alignBoxes,
  alignHotspots,
  distributeBoxes,
  distributeHotspots,
  matchSize,
  sizeBoxes,
} from './align';

const canvas = { width: 2048, height: 1536 };
const a = { x: 100, y: 100, width: 200, height: 100 };
const b = { x: 500, y: 300, width: 100, height: 300 };
const frame = { x: 100, y: 100, width: 500, height: 500 };

describe('alignBoxes (spec ED-18)', () => {
  it.each([
    ['left', { x: 100, y: 100 }, { x: 100, y: 300 }],
    ['center', { x: 250, y: 100 }, { x: 300, y: 300 }],
    ['right', { x: 400, y: 100 }, { x: 500, y: 300 }],
    ['top', { x: 100, y: 100 }, { x: 500, y: 100 }],
    ['middle', { x: 100, y: 300 }, { x: 500, y: 200 }],
    ['bottom', { x: 100, y: 500 }, { x: 500, y: 300 }],
  ] as const)('%s lines the boxes up with the frame', (alignment, at, bt) => {
    expect(alignBoxes({ a, b }, alignment, frame)).toEqual({
      a: { ...a, ...at },
      b: { ...b, ...bt },
    });
  });

  it('rounds a centre to whole pixels', () => {
    const odd = { x: 0, y: 0, width: 101, height: 51 };
    expect(alignBoxes({ odd }, 'center', { x: 0, y: 0, width: 200, height: 200 }).odd!.x).toBe(50);
    expect(alignBoxes({ odd }, 'middle', { x: 0, y: 0, width: 200, height: 200 }).odd!.y).toBe(75);
  });
});

describe('distributeBoxes (spec ED-18)', () => {
  it('makes the gaps equal between boxes of different widths, the outermost fixed', () => {
    const boxes = {
      one: { x: 0, y: 0, width: 100, height: 50 },
      three: { x: 900, y: 0, width: 100, height: 50 },
      two: { x: 150, y: 0, width: 300, height: 50 },
    };
    // Span 0–1000, widths 500: two gaps of 250.
    expect(distributeBoxes(boxes, 'horizontal')).toEqual({
      one: boxes.one,
      two: { ...boxes.two, x: 350 },
      three: boxes.three,
    });
  });

  it('rounds each place from the exact one, so rounding does not add up', () => {
    const boxes = {
      p: { x: 0, y: 0, width: 10, height: 10 },
      q: { x: 0, y: 5, width: 10, height: 10 },
      r: { x: 0, y: 6, width: 10, height: 10 },
      s: { x: 0, y: 100, width: 10, height: 10 },
    };
    // Span 0–110, heights 40: three gaps of 23.33 → 33.33, 66.67.
    const spread = distributeBoxes(boxes, 'vertical');
    expect(['p', 'q', 'r', 's'].map((id) => spread[id]!.y)).toEqual([0, 33, 67, 100]);
    expect(spread.q!.x).toBe(0);
  });

  it('leaves fewer than three boxes as they are', () => {
    const two = { a, b };
    expect(distributeBoxes(two, 'horizontal')).toBe(two);
  });
});

describe('sizeBoxes (spec ED-18)', () => {
  const model = { x: 0, y: 0, width: 300, height: 400 };

  it.each([
    ['width', { width: 300, height: 100 }],
    ['height', { width: 200, height: 400 }],
    ['both', { width: 300, height: 400 }],
  ] as const)('gives the %s of the model', (dimension, size) => {
    expect(sizeBoxes({ a }, model, dimension, canvas).a).toEqual({ x: 100, y: 100, ...size });
  });

  it('moves a box back inside the canvas when it would reach past the edge', () => {
    const corner = { x: 1900, y: 1400, width: 100, height: 100 };
    expect(sizeBoxes({ corner }, model, 'both', canvas).corner).toEqual({
      x: 1748,
      y: 1136,
      width: 300,
      height: 400,
    });
  });
});

describe('hotspot operations (spec ED-18)', () => {
  // Home: cards A, B, C are 560 × 720 at y 500, x 144, 744, 1344; About 144 × 144 at (1760, 1244).
  const box = (project: Project, id: string) => {
    const h = project.pages[0]!.hotspots.find((x) => x.id === id)!;
    return { x: h.x, y: h.y, width: h.width, height: h.height };
  };
  const expectValid = (project: Project) =>
    expect(validateProject(project)).toMatchObject({ ok: true });

  it('aligns several to their common box', () => {
    const project = alignHotspots(demoProject(), 'p_home00', ['h_carda0', 'h_about0'], 'bottom');
    // Common bottom: About's, at 1388.
    expect(box(project, 'h_carda0').y).toBe(1388 - 720);
    expect(box(project, 'h_about0').y).toBe(1244);
    expectValid(project);
  });

  it('aligns one hotspot to the canvas', () => {
    const right = alignHotspots(demoProject(), 'p_home00', ['h_about0'], 'right');
    expect(box(right, 'h_about0').x).toBe(2048 - 144);
    const centre = alignHotspots(demoProject(), 'p_home00', ['h_about0'], 'middle');
    expect(box(centre, 'h_about0').y).toBe((1536 - 144) / 2);
  });

  it('changes nothing without hotspots', () => {
    const before = demoProject();
    expect(alignHotspots(before, 'p_home00', [], 'left')).toBe(before);
    expect(matchSize(before, 'p_home00', [], 'both')).toBe(before);
  });

  it('distributes three or more with equal gaps', () => {
    const before = demoProject();
    before.pages[0]!.hotspots[1]!.x = 800; // B off centre
    const project = distributeHotspots(
      before,
      'p_home00',
      ['h_carda0', 'h_cardb0', 'h_cardc0'],
      'horizontal',
    );
    expect(box(project, 'h_cardb0').x).toBe(744);
    expect(box(project, 'h_carda0').x).toBe(144);
    expect(box(project, 'h_cardc0').x).toBe(1344);
    // Two are not spread.
    const two = distributeHotspots(before, 'p_home00', ['h_carda0', 'h_cardb0'], 'horizontal');
    expect(box(two, 'h_cardb0').x).toBe(800);
  });

  it('matches the size of the first in page order, whatever order the ids come in', () => {
    const project = matchSize(demoProject(), 'p_home00', ['h_about0', 'h_call00'], 'width');
    // The page lists About before "Call our team": About's 144 wins.
    expect(box(project, 'h_call00').width).toBe(144);
    expect(box(project, 'h_about0').width).toBe(144);
    const both = matchSize(demoProject(), 'p_home00', ['h_call00', 'h_carda0'], 'both');
    // Card A is first; "Call our team" grows to 560 × 720 and moves back inside the canvas.
    expect(box(both, 'h_call00')).toEqual({ x: 1488, y: 76, width: 560, height: 720 });
    expectValid(both);
  });
});
