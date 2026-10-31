import { type Project, validateProject } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { addHotspot, nudgeHotspot, placeHotspot } from './hotspots';

const expectValid = (project: Project) =>
  expect(validateProject(project)).toMatchObject({ ok: true });
const home = (project: Project) => project.pages[0]!;

describe('hotspot operations (spec HS-1, HS-2)', () => {
  describe('addHotspot', () => {
    it('adds an invisible hotspot that does nothing, a fifth of the canvas, in the centre', () => {
      const { project, hotspotId } = addHotspot(demoProject(), 'p_home00');
      const added = home(project).hotspots.at(-1)!;
      expect(added).toEqual({
        id: hotspotId,
        name: 'Hotspot 6',
        x: 819, // (2048 - 410) / 2
        y: 615, // (1536 - 307) / 2, rounded
        width: 410,
        height: 307,
        shape: { type: 'rect', cornerRadius: 0 },
        style: { fill: null, border: null, opacity: 1 },
        pressEffect: 'press',
        action: { goTo: null, command: null },
      });
      expectValid(project);
    });

    it('puts it on top of the others: last in the list', () => {
      const before = demoProject();
      const { project } = addHotspot(before, 'p_home00');
      expect(home(project).hotspots.slice(0, -1)).toEqual(home(before).hotspots);
    });

    it('takes the first free name and an id not used on any page', () => {
      const before = demoProject();
      home(before).hotspots[0]!.name = 'Hotspot 6';
      const { project, hotspotId } = addHotspot(before, 'p_home00');
      expect(home(project).hotspots.at(-1)?.name).toBe('Hotspot 7');
      const ids = before.pages.flatMap((p) => p.hotspots.map((h) => h.id));
      expect(ids).not.toContain(hotspotId);
    });

    it('never reuses an id taken by a hotspot on another page', () => {
      const before = demoProject();
      before.pages[1]!.hotspots[0]!.id = 'h_aaaaaa';
      // The first id tried is h_aaaaaa (taken on Product A), the next h_bbbbbb.
      const random = [0, 0, 0, 0, 0, 0, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03];
      let i = 0;
      const { hotspotId } = addHotspot(before, 'p_home00', () => random[i++]!);
      expect(hotspotId).toBe('h_bbbbbb');
    });

    it('fits any canvas size', () => {
      const before = demoProject();
      before.canvas = { ...before.canvas, width: 1920, height: 1080 };
      before.pages = before.pages.map((p) => ({ ...p, hotspots: [] }));
      const { project } = addHotspot(before, 'p_home00');
      expect(home(project).hotspots[0]).toMatchObject({ x: 768, y: 432, width: 384, height: 216 });
      expectValid(project);
    });

    it('adds nothing to a page that is not there', () => {
      const before = demoProject();
      expect(addHotspot(before, 'p_zzzzzz')).toEqual({ project: before, hotspotId: null });
    });
  });

  describe('placeHotspot', () => {
    it('sets the box and keeps everything else', () => {
      const before = demoProject();
      const project = placeHotspot(before, 'p_home00', 'h_carda0', {
        x: 10,
        y: 20,
        width: 30,
        height: 40,
      });
      const moved = home(project).hotspots.find((h) => h.id === 'h_carda0');
      const original = home(before).hotspots.find((h) => h.id === 'h_carda0');
      expect(moved).toEqual({ ...original, x: 10, y: 20, width: 30, height: 40 });
      expectValid(project);
    });

    it('keeps the project when the box is the same, or the hotspot is not there', () => {
      const before = demoProject();
      const same = { x: 144, y: 500, width: 560, height: 720 };
      expect(placeHotspot(before, 'p_home00', 'h_carda0', same)).toBe(before);
      expect(placeHotspot(before, 'p_proda0', 'h_carda0', same)).toBe(before);
    });
  });

  describe('nudgeHotspot', () => {
    it('moves from where the hotspot is now, kept inside the canvas', () => {
      const project = nudgeHotspot(demoProject(), 'p_home00', 'h_carda0', 10, -1);
      expect(home(project).hotspots.find((h) => h.id === 'h_carda0')).toMatchObject({
        x: 154,
        y: 499,
      });
      const atEdge = nudgeHotspot(demoProject(), 'p_home00', 'h_carda0', -1000, 0);
      expect(home(atEdge).hotspots.find((h) => h.id === 'h_carda0')?.x).toBe(0);
    });

    it('keeps the project for a hotspot that is not there', () => {
      const before = demoProject();
      expect(nudgeHotspot(before, 'p_home00', 'h_zzzzzz', 1, 0)).toBe(before);
    });
  });
});
