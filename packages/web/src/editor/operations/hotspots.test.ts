import { type Project, validateProject } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import {
  addHotspot,
  deleteHotspot,
  DUPLICATE_OFFSET,
  duplicateHotspot,
  nudgeHotspot,
  placeHotspot,
  renameHotspot,
  restackHotspot,
} from './hotspots';

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

  const ids = (project: Project) => home(project).hotspots.map((h) => h.id);

  describe('renameHotspot', () => {
    it('renames, trimming spaces; an empty name is allowed', () => {
      expect(
        home(renameHotspot(demoProject(), 'p_home00', 'h_carda0', '  Card A ')).hotspots[0]?.name,
      ).toBe('Card A');
      const empty = renameHotspot(demoProject(), 'p_home00', 'h_carda0', '   ');
      expect(home(empty).hotspots[0]?.name).toBe('');
      expectValid(empty);
    });

    it('keeps the project for a name over 100 characters, or the same name', () => {
      const before = demoProject();
      expect(renameHotspot(before, 'p_home00', 'h_carda0', 'x'.repeat(101))).toBe(before);
      expect(renameHotspot(before, 'p_home00', 'h_carda0', 'Product A card')).toBe(before);
    });
  });

  describe('duplicateHotspot (spec HS-7)', () => {
    it('copies every property with a new id, 20 px right and down, just above the original', () => {
      const before = demoProject();
      const { project, hotspotId } = duplicateHotspot(before, 'p_home00', 'h_carda0');
      const original = home(before).hotspots[0]!;
      const copy = home(project).hotspots[1]!;
      expect(DUPLICATE_OFFSET).toBe(20);
      expect(copy).toEqual({ ...original, id: hotspotId, x: 164, y: 520 });
      expect(ids(project)).toEqual(['h_carda0', hotspotId, ...ids(before).slice(1)]);
      expectValid(project);
    });

    it('keeps the copy inside the canvas when the original is at the edge', () => {
      const before = demoProject();
      Object.assign(home(before).hotspots[0]!, { x: 1488, y: 816 }); // touching right and bottom
      const { project } = duplicateHotspot(before, 'p_home00', 'h_carda0');
      expect(home(project).hotspots[1]).toMatchObject({ x: 1488, y: 816 });
      expectValid(project);
    });

    it('gives the copy its own objects: changing one never changes the other', () => {
      const { project } = duplicateHotspot(demoProject(), 'p_home00', 'h_carda0');
      expect(home(project).hotspots[1]!.action).not.toBe(home(project).hotspots[0]!.action);
      expect(home(project).hotspots[1]!.style).not.toBe(home(project).hotspots[0]!.style);
    });

    it('copies nothing for a hotspot that is not there', () => {
      const before = demoProject();
      expect(duplicateHotspot(before, 'p_home00', 'h_zzzzzz')).toEqual({
        project: before,
        hotspotId: null,
      });
    });
  });

  describe('deleteHotspot', () => {
    it('deletes only that hotspot', () => {
      const before = demoProject();
      const project = deleteHotspot(before, 'p_home00', 'h_carda0');
      expect(ids(project)).toEqual(ids(before).slice(1));
      expect(project.pages[1]).toBe(before.pages[1]);
      expectValid(project);
    });

    it('keeps the project for a hotspot that is not there', () => {
      const before = demoProject();
      expect(deleteHotspot(before, 'p_home00', 'h_zzzzzz')).toBe(before);
    });
  });

  describe('restackHotspot (spec HS-6)', () => {
    it('moves a hotspot one step up or down the drawing order', () => {
      const before = demoProject();
      const [a, b, c] = ids(before);
      expect(ids(restackHotspot(before, 'p_home00', a!, 'forward')).slice(0, 3)).toEqual([b, a, c]);
      expect(ids(restackHotspot(before, 'p_home00', b!, 'backward')).slice(0, 3)).toEqual([
        b,
        a,
        c,
      ]);
    });

    it('keeps the project at the top and at the bottom', () => {
      const before = demoProject();
      expect(restackHotspot(before, 'p_home00', ids(before)[0]!, 'backward')).toBe(before);
      expect(restackHotspot(before, 'p_home00', ids(before).at(-1)!, 'forward')).toBe(before);
    });
  });
});
